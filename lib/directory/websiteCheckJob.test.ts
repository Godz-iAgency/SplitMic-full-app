import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mocked: these tests cover the job's own batching, resumability, and status
// bookkeeping — not the actual HTTP check (that's websiteCheck.test.ts).
vi.mock("./websiteCheck", () => ({ checkWebsiteLive: vi.fn() }));

import { checkWebsiteLive } from "./websiteCheck";
import {
  checkWebsites,
  resetWebsiteChecks,
  deactivateDeadListings,
  WEBSITE_CHECK_BATCH_SIZE,
} from "./websiteCheckJob";

const mockCheck = vi.mocked(checkWebsiteLive);

const NOW = new Date("2026-08-11T12:00:00Z");

type Row = { id: string; business_name: string; website_url: string | null };

type FakeState = {
  updates: { id: string; payload: Record<string, unknown> }[];
  isFilters: { column: string; value: unknown }[];
  inFilters: { column: string; values: unknown[] }[];
  eqFilters: { column: string; value: unknown }[];
  limitUsed: number | null;
};

function fakeSupabase(
  opts: {
    pending?: Row[];
    selectError?: string;
    /** Rows returned by the deactivateDeadListings select-then-update pair. */
    deadRows?: { id: string; business_name: string; website_url: string | null; website_check_reason: string | null }[];
  } = {},
) {
  const state: FakeState = { updates: [], isFilters: [], inFilters: [], eqFilters: [], limitUsed: null };
  const pending = opts.pending ?? [];

  const client = {
    from(_table: string) {
      let pendingUpdate: Record<string, unknown> | null = null;
      let isHeadCount = false;
      const eqChain: [string, unknown][] = [];

      const builder: Record<string, unknown> = {
        select: (_cols: string, options?: { head?: boolean }) => {
          isHeadCount = Boolean(options?.head);
          return builder;
        },
        is: (column: string, value: unknown) => {
          state.isFilters.push({ column, value });
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          state.inFilters.push({ column, values });
          return Promise.resolve({
            count: opts.selectError ? null : pending.length,
            error: opts.selectError ? { message: opts.selectError } : null,
          });
        },
        // Stays chainable regardless of how many eq()s are stacked (a
        // single-row update chains one, the bulk deactivate update/select
        // chain two) — resolution only happens in then(), matching the real
        // query builder.
        eq: (column: string, value: unknown) => {
          eqChain.push([column, value]);
          state.eqFilters.push({ column, value });
          return builder;
        },
        order: () => builder,
        limit: (n: number) => {
          state.limitUsed = n;
          return Promise.resolve({
            data: opts.selectError ? null : pending.slice(0, n),
            error: opts.selectError ? { message: opts.selectError } : null,
          });
        },
        update: (payload: Record<string, unknown>) => {
          pendingUpdate = payload;
          return builder;
        },
        then: (resolve: (value: unknown) => unknown) => {
          if (pendingUpdate && eqChain.length === 1 && eqChain[0][0] === "id") {
            // Single-row update, e.g. mark()'s .update(payload).eq("id", id).
            state.updates.push({ id: String(eqChain[0][1]), payload: pendingUpdate });
            return resolve({ error: null });
          }
          if (pendingUpdate) {
            // Bulk update, e.g. deactivateDeadListings'
            // .update(payload).eq("website_status","dead").eq("is_active",true).
            return resolve({ error: null });
          }
          if (opts.deadRows !== undefined) {
            // deactivateDeadListings' select-then-eq lookup.
            return resolve({ data: opts.deadRows, error: null });
          }
          return resolve(
            isHeadCount
              ? {
                  count: opts.selectError ? null : pending.length,
                  error: opts.selectError ? { message: opts.selectError } : null,
                }
              : { data: [], error: null },
          );
        },
      };

      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

beforeEach(() => {
  mockCheck.mockReset();
});

describe("checkWebsites", () => {
  it("checks each pending row and tallies live/dead/uncertain", async () => {
    mockCheck
      .mockResolvedValueOnce({ status: "live", httpStatus: 200, reason: "Site responded 200" })
      .mockResolvedValueOnce({ status: "dead", httpStatus: 404, reason: "Site returned 404" })
      .mockResolvedValueOnce({ status: "uncertain", httpStatus: null, reason: "Timed out fetching the site" });

    const { client } = fakeSupabase({
      pending: [
        { id: "r1", business_name: "A", website_url: "https://a.com" },
        { id: "r2", business_name: "B", website_url: "https://b.com" },
        { id: "r3", business_name: "C", website_url: "https://c.com" },
      ],
    });

    const result = await checkWebsites(client, { now: NOW });

    expect(result).toMatchObject({ attempted: 3, live: 1, dead: 1, uncertain: 1, skipped: 0 });
    expect(result.deadListings).toEqual([
      { id: "r2", businessName: "B", websiteUrl: "https://b.com", reason: "Site returned 404" },
    ]);
  });

  it("skips a listing with no website without making a request", async () => {
    const { client } = fakeSupabase({
      pending: [{ id: "r1", business_name: "No Site", website_url: null }],
    });

    const result = await checkWebsites(client, { now: NOW });

    expect(mockCheck).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: 1, live: 0, dead: 0, uncertain: 0 });
  });

  it("only ever selects rows that were never checked", async () => {
    const { client, state } = fakeSupabase({ pending: [] });
    await checkWebsites(client, { now: NOW });
    expect(state.isFilters).toContainEqual({ column: "website_status", value: null });
  });

  it("checks nothing on a dry run", async () => {
    const { client, state } = fakeSupabase({
      pending: [{ id: "r1", business_name: "A", website_url: "https://a.com" }],
    });

    const result = await checkWebsites(client, { now: NOW, dryRun: true });

    expect(mockCheck).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
    expect(result).toMatchObject({ dryRun: true, attempted: 1, live: 0 });
  });

  it("defaults to a bounded batch", async () => {
    const { client, state } = fakeSupabase({ pending: [] });
    await checkWebsites(client, { now: NOW });
    expect(state.limitUsed).toBe(WEBSITE_CHECK_BATCH_SIZE);
  });

  it("reports how many rows are still waiting", async () => {
    mockCheck.mockResolvedValue({ status: "live", httpStatus: 200, reason: "Site responded 200" });
    const { client } = fakeSupabase({
      pending: [{ id: "r1", business_name: "A", website_url: "https://a.com" }],
    });

    const result = await checkWebsites(client, { now: NOW });

    expect(result.remainingBefore).toBe(1);
  });

  it("reports a lookup failure instead of throwing", async () => {
    const { client } = fakeSupabase({ selectError: "connection lost" });
    const result = await checkWebsites(client, { now: NOW });
    expect(result.error).toBe("connection lost");
    expect(mockCheck).not.toHaveBeenCalled();
  });
});

describe("resetWebsiteChecks", () => {
  it("clears dead and uncertain rows back to unchecked by default", async () => {
    const { client, state } = fakeSupabase({ pending: [{ id: "r1", business_name: "A", website_url: null }] });
    const result = await resetWebsiteChecks(client);
    expect(result.reset).toBe(1);
    expect(state.inFilters).toContainEqual({ column: "website_status", values: ["dead", "uncertain"] });
  });

  it("honours an explicit status subset", async () => {
    const { client, state } = fakeSupabase({ pending: [] });
    await resetWebsiteChecks(client, ["dead"]);
    expect(state.inFilters).toContainEqual({ column: "website_status", values: ["dead"] });
  });
});

describe("deactivateDeadListings", () => {
  it("hides every confirmed-dead active listing and reports which ones", async () => {
    const { client } = fakeSupabase({
      deadRows: [
        { id: "r1", business_name: "Closed Venue", website_url: "https://gone.com", website_check_reason: "Site returned 404" },
      ],
    });

    const result = await deactivateDeadListings(client);

    expect(result.deactivated).toBe(1);
    expect(result.businesses).toEqual([
      { id: "r1", businessName: "Closed Venue", websiteUrl: "https://gone.com", reason: "Site returned 404" },
    ]);
  });

  it("does nothing when there are no dead listings", async () => {
    const { client } = fakeSupabase({ deadRows: [] });
    const result = await deactivateDeadListings(client);
    expect(result).toEqual({ deactivated: 0, businesses: [] });
  });
});
