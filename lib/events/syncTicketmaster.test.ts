import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Same mocking shape as sync.test.ts: cover syncTicketmasterEvents' own
// orchestration, not Ticketmaster's fetch accuracy or the matching
// algorithm (each has its own test file).
vi.mock("./providers/ticketmaster", async () => {
  const actual = await vi.importActual<typeof import("./providers/ticketmaster")>(
    "./providers/ticketmaster",
  );
  return { ...actual, fetchTicketmasterEvents: vi.fn() };
});
vi.mock("./matching", () => ({
  loadMatchCandidates: vi.fn().mockResolvedValue({ bands: [], venues: [] }),
  findMatch: vi.fn().mockReturnValue(null),
  loadDirectoryVenueCandidates: vi.fn().mockResolvedValue([]),
  findDirectoryVenueMatch: vi.fn().mockReturnValue(null),
}));

import { fetchTicketmasterEvents } from "./providers/ticketmaster";
import { syncTicketmasterEvents } from "./sync";

const mockFetch = vi.mocked(fetchTicketmasterEvents);

const NOW = new Date("2026-08-17T12:00:00Z");

const TM_EVENT_A = {
  id: "tm-event-a",
  name: "Gary Clark Jr.",
  url: "https://www.ticketmaster.com/event/tm-event-a",
  dates: { start: { dateTime: "2026-08-20T01:00:00Z" } },
  images: [],
  classifications: [{ genre: { name: "Rock" } }],
  _embedded: {
    venues: [{ name: "ACL Live" }],
    attractions: [{ name: "Gary Clark Jr." }],
  },
};

type FakeState = {
  upsertCalled: boolean;
  upsertRows: unknown[];
  upsertError?: string;
  updateCalled: boolean;
  deactivateCount: number;
  updateError?: string;
  notArg: string | null;
  eqArgs: [string, unknown][];
};

function fakeSupabase(
  overrides: Partial<Pick<FakeState, "upsertError" | "updateError" | "deactivateCount">> = {},
) {
  const state: FakeState = {
    upsertCalled: false,
    upsertRows: [],
    updateCalled: false,
    deactivateCount: overrides.deactivateCount ?? 0,
    notArg: null,
    eqArgs: [],
    ...overrides,
  };

  const client = {
    from(_table: string) {
      const builder: Record<string, unknown> = {
        upsert: (rows: unknown[]) => {
          state.upsertCalled = true;
          state.upsertRows = rows;
          return Promise.resolve({
            error: state.upsertError ? { message: state.upsertError } : null,
            count: rows.length,
          });
        },
        update: () => {
          state.updateCalled = true;
          return builder;
        },
        eq: (col: string, value: unknown) => {
          state.eqArgs.push([col, value]);
          return builder;
        },
        gte: () => builder,
        not: (_col: string, _op: string, value: string) => {
          state.notArg = value;
          return builder;
        },
        then: (resolve: (value: unknown) => unknown) =>
          resolve({
            error: state.updateError ? { message: state.updateError } : null,
            count: state.deactivateCount,
          }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("syncTicketmasterEvents", () => {
  it("fails without touching the database when the fetch fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, reason: "TICKETMASTER_API_KEY is not set" });
    const { client, state } = fakeSupabase();

    const result = await syncTicketmasterEvents(client, { now: NOW });

    expect(result.error).toContain("TICKETMASTER_API_KEY is not set");
    expect(state.upsertCalled).toBe(false);
    expect(state.updateCalled).toBe(false);
  });

  it("upserts events from a successful fetch", async () => {
    mockFetch.mockResolvedValue({ ok: true, data: [TM_EVENT_A] });
    const { client, state } = fakeSupabase();

    const result = await syncTicketmasterEvents(client, { now: NOW });

    expect(result.error).toBeUndefined();
    expect(state.upsertCalled).toBe(true);
    expect(state.upsertRows).toHaveLength(1);
    expect(result.eventsUpserted).toBe(1);
  });

  it("writes rows with source = ticketmaster, never do512", async () => {
    mockFetch.mockResolvedValue({ ok: true, data: [TM_EVENT_A] });
    const { client, state } = fakeSupabase();

    await syncTicketmasterEvents(client, { now: NOW });

    expect((state.upsertRows[0] as { source: string }).source).toBe("ticketmaster");
  });

  it("scopes deactivation to ticketmaster's own source, never Do512's rows", async () => {
    // The exact bug this architecture has to prevent: without source
    // scoping, a Ticketmaster sync would deactivate every Do512 row, since
    // Do512 rows never appear in Ticketmaster's own fetched result set.
    mockFetch.mockResolvedValue({ ok: true, data: [TM_EVENT_A] });
    const { client, state } = fakeSupabase();

    await syncTicketmasterEvents(client, { now: NOW });

    expect(state.eqArgs).toContainEqual(["source", "ticketmaster"]);
    expect(state.eqArgs).not.toContainEqual(["source", "do512"]);
  });

  it("is never partial — a single fetch either fully succeeds or fails closed", async () => {
    mockFetch.mockResolvedValue({ ok: true, data: [TM_EVENT_A] });
    const { client, state } = fakeSupabase({ deactivateCount: 3 });

    const result = await syncTicketmasterEvents(client, { now: NOW });

    expect(result.partial).toBe(false);
    expect(state.updateCalled).toBe(true);
    expect(result.eventsDeactivated).toBe(3);
  });

  it("skips events that already happened", async () => {
    const pastEvent = {
      ...TM_EVENT_A,
      dates: { start: { dateTime: "2026-08-10T01:00:00Z" } },
    };
    mockFetch.mockResolvedValue({ ok: true, data: [pastEvent] });
    const { client, state } = fakeSupabase();

    const result = await syncTicketmasterEvents(client, { now: NOW });

    expect(state.upsertCalled).toBe(false);
    expect(result.eventsUpserted).toBe(0);
    expect(result.eventsSkippedPast).toBe(1);
  });

  it("runs a dry run without writing anything", async () => {
    mockFetch.mockResolvedValue({ ok: true, data: [TM_EVENT_A] });
    const { client, state } = fakeSupabase();

    const result = await syncTicketmasterEvents(client, { now: NOW, dryRun: true });

    expect(state.upsertCalled).toBe(false);
    expect(state.updateCalled).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.eventsUpserted).toBe(1);
  });

  it("reports an upsert failure instead of claiming success", async () => {
    mockFetch.mockResolvedValue({ ok: true, data: [TM_EVENT_A] });
    const { client } = fakeSupabase({ upsertError: "permission denied" });

    const result = await syncTicketmasterEvents(client, { now: NOW });

    expect(result.error).toBe("permission denied");
  });

  it("dedupes a Ticketmaster event that appears twice (e.g. overlapping pages)", async () => {
    mockFetch.mockResolvedValue({ ok: true, data: [TM_EVENT_A, TM_EVENT_A] });
    const { client } = fakeSupabase();

    const result = await syncTicketmasterEvents(client, { now: NOW });

    expect(result.eventsUpserted).toBe(1);
  });
});
