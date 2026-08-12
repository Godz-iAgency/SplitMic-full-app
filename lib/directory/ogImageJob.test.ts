import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mocked: these tests cover the job's own batching, resumability, and status
// bookkeeping — not the actual HTTP fetch/HTML parsing (that's ogImage.test.ts).
vi.mock("./ogImage", () => ({ fetchOgImage: vi.fn() }));

import { fetchOgImage } from "./ogImage";
import { backfillOgImages, OG_IMAGE_BATCH_SIZE } from "./ogImageJob";

const mockFetch = vi.mocked(fetchOgImage);

const NOW = new Date("2026-08-11T12:00:00Z");

type Row = { id: string; business_name: string; website_url: string | null };

type FakeState = {
  updates: { id: string; payload: Record<string, unknown> }[];
  isFilters: { column: string; value: unknown }[];
  limitUsed: number | null;
};

function fakeSupabase(opts: { pending?: Row[]; selectError?: string } = {}) {
  const state: FakeState = { updates: [], isFilters: [], limitUsed: null };
  const pending = opts.pending ?? [];

  const client = {
    from(_table: string) {
      let pendingUpdate: Record<string, unknown> | null = null;
      let isHeadCount = false;

      const builder: Record<string, unknown> = {
        select: (_cols: string, options?: { head?: boolean }) => {
          isHeadCount = Boolean(options?.head);
          return builder;
        },
        // Stays chainable regardless of how many filters are stacked before
        // the query resolves — matches the real query builder, which only
        // actually runs on await/.then().
        is: (column: string, value: unknown) => {
          state.isFilters.push({ column, value });
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
        eq: (_col: string, id: string) => {
          if (pendingUpdate) state.updates.push({ id, payload: pendingUpdate });
          return Promise.resolve({ error: null });
        },
        // Reached only by the head-count query (select + is(), awaited
        // directly with no .limit() in the chain).
        then: (resolve: (value: unknown) => unknown) =>
          resolve(
            isHeadCount
              ? {
                  count: opts.selectError ? null : pending.length,
                  error: opts.selectError ? { message: opts.selectError } : null,
                }
              : { data: [], error: null },
          ),
      };

      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("backfillOgImages", () => {
  it("finds and stores an image, marking the row done", async () => {
    mockFetch.mockResolvedValue({ ok: true, url: "https://mohawk.com/hero.jpg" });
    const { client, state } = fakeSupabase({
      pending: [{ id: "r1", business_name: "Mohawk", website_url: "https://mohawk.com" }],
    });

    const result = await backfillOgImages(client, { now: NOW });

    expect(result).toMatchObject({ attempted: 1, found: 1, noImage: 0, failed: 0 });
    expect(state.updates[0].payload).toMatchObject({
      og_image_status: "done",
      og_image_url: "https://mohawk.com/hero.jpg",
    });
  });

  it("marks a page with no preview image as no_image, not failed", async () => {
    mockFetch.mockResolvedValue({ ok: true, url: null });
    const { client, state } = fakeSupabase({
      pending: [{ id: "r1", business_name: "Mohawk", website_url: "https://mohawk.com" }],
    });

    const result = await backfillOgImages(client, { now: NOW });

    expect(result).toMatchObject({ noImage: 1, found: 0, failed: 0 });
    expect(state.updates[0].payload).toMatchObject({ og_image_status: "no_image" });
    expect(state.updates[0].payload).not.toHaveProperty("og_image_url");
  });

  describe("resumability (this is the whole point — never re-check a row)", () => {
    it("only ever selects rows that were never checked", async () => {
      const { client, state } = fakeSupabase({ pending: [] });
      await backfillOgImages(client, { now: NOW });
      expect(state.isFilters).toContainEqual({ column: "og_image_status", value: null });
    });

    it("checks nothing on a dry run", async () => {
      const { client, state } = fakeSupabase({
        pending: [{ id: "r1", business_name: "Mohawk", website_url: "https://mohawk.com" }],
      });

      const result = await backfillOgImages(client, { now: NOW, dryRun: true });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(state.updates).toHaveLength(0);
      expect(result).toMatchObject({ dryRun: true, attempted: 1, found: 0 });
    });

    it("defaults to a bounded batch", async () => {
      const { client, state } = fakeSupabase({ pending: [] });
      await backfillOgImages(client, { now: NOW });
      expect(state.limitUsed).toBe(OG_IMAGE_BATCH_SIZE);
    });
  });

  describe("failure handling", () => {
    it("marks a failed fetch rather than retrying it forever", async () => {
      mockFetch.mockResolvedValue({ ok: false, reason: "Timed out fetching the site" });
      const { client, state } = fakeSupabase({
        pending: [{ id: "r1", business_name: "Mohawk", website_url: "https://mohawk.com" }],
      });

      const result = await backfillOgImages(client, { now: NOW });

      expect(result.failed).toBe(1);
      expect(state.updates[0].payload).toMatchObject({ og_image_status: "failed" });
      expect(result.failures[0]).toEqual({
        businessName: "Mohawk",
        reason: "Timed out fetching the site",
      });
    });

    it("skips a listing with no website without making a request", async () => {
      const { client, state } = fakeSupabase({
        pending: [{ id: "r1", business_name: "No Site", website_url: null }],
      });

      const result = await backfillOgImages(client, { now: NOW });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toMatchObject({ skipped: 1, found: 0, failed: 0 });
      expect(state.updates[0].payload).toMatchObject({ og_image_status: "skipped" });
    });

    it("keeps going after one row fails", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, reason: "boom" })
        .mockResolvedValueOnce({ ok: true, url: "https://b.com/img.jpg" });

      const { client } = fakeSupabase({
        pending: [
          { id: "r1", business_name: "A", website_url: "https://a.com" },
          { id: "r2", business_name: "B", website_url: "https://b.com" },
        ],
      });

      const result = await backfillOgImages(client, { now: NOW });

      expect(result).toMatchObject({ attempted: 2, found: 1, failed: 1 });
    });

    it("reports a lookup failure instead of throwing", async () => {
      const { client } = fakeSupabase({ selectError: "connection lost" });

      const result = await backfillOgImages(client, { now: NOW });

      expect(result.error).toBe("connection lost");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
