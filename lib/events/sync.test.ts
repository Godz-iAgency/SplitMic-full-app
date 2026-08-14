import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Both collaborators are mocked: these tests cover sync.ts's own
// upsert/deactivate orchestration, not Firecrawl's scraping accuracy or the
// matching algorithm (each has its own test file).
vi.mock("./do512", async () => {
  const actual = await vi.importActual<typeof import("./do512")>("./do512");
  return {
    ...actual,
    scrapeDo512Events: vi.fn(),
  };
});
vi.mock("./matching", () => ({
  loadMatchCandidates: vi.fn().mockResolvedValue({ bands: [], venues: [] }),
  findMatch: vi.fn().mockReturnValue(null),
}));

import { scrapeDo512Events } from "./do512";
import { syncLiveEvents } from "./sync";

const mockScrape = vi.mocked(scrapeDo512Events);

const NOW = new Date("2026-08-15T12:00:00Z");

const EVENT_A = {
  artist_name: "Band A",
  venue_name: "Venue A",
  event_date: "2026-08-15",
  event_time: "20:00",
};

// ── Fake Supabase client ────────────────────────────────────────────────────

type FakeState = {
  upsertCalled: boolean;
  upsertRows: unknown[];
  upsertError?: string;
  updateCalled: boolean;
  deactivateCount: number;
  updateError?: string;
  notArg: string | null;
};

function fakeSupabase(overrides: Partial<Pick<FakeState, "upsertError" | "updateError" | "deactivateCount">> = {}) {
  const state: FakeState = {
    upsertCalled: false,
    upsertRows: [],
    updateCalled: false,
    deactivateCount: overrides.deactivateCount ?? 0,
    notArg: null,
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
        eq: () => builder,
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
  mockScrape.mockReset();
});

describe("syncLiveEvents", () => {
  it("fails without touching the database when both scrapes fail", async () => {
    mockScrape.mockResolvedValue({ ok: false, reason: "down" });
    const { client, state } = fakeSupabase();

    const result = await syncLiveEvents(client, { now: NOW });

    expect(result.error).toContain("down");
    expect(state.upsertCalled).toBe(false);
    expect(state.updateCalled).toBe(false);
  });

  it("upserts events from a successful scrape", async () => {
    mockScrape.mockResolvedValue({ ok: true, data: [EVENT_A] });
    const { client, state } = fakeSupabase();

    const result = await syncLiveEvents(client, { now: NOW });

    expect(result.error).toBeUndefined();
    expect(state.upsertCalled).toBe(true);
    expect(state.upsertRows).toHaveLength(1);
    expect(result.eventsUpserted).toBe(1);
  });

  it("dedupes the same event appearing on both the today and week pages", async () => {
    mockScrape.mockResolvedValue({ ok: true, data: [EVENT_A] }); // same result for both calls

    const { client } = fakeSupabase();
    const result = await syncLiveEvents(client, { now: NOW });

    expect(result.eventsUpserted).toBe(1);
  });

  it("skips events that already happened", async () => {
    const pastEvent = { ...EVENT_A, event_date: "2026-08-10", event_time: "20:00" };
    mockScrape.mockResolvedValue({ ok: true, data: [pastEvent] });
    const { client, state } = fakeSupabase();

    const result = await syncLiveEvents(client, { now: NOW });

    expect(state.upsertCalled).toBe(false);
    expect(result.eventsUpserted).toBe(0);
  });

  it("reports how many events were skipped for being in the past", async () => {
    // Without this number, a stale source page looks identical to a healthy
    // quiet night: both report "scraped N, upserted 0". A stale-cache bug hid
    // behind exactly that ambiguity for a full day.
    const pastEvent = { ...EVENT_A, event_date: "2026-08-10", event_time: "20:00" };
    mockScrape.mockResolvedValue({ ok: true, data: [pastEvent] });
    const { client } = fakeSupabase();

    const result = await syncLiveEvents(client, { now: NOW });

    expect(result.eventsSkippedPast).toBe(1);
    expect(result.eventsUpserted).toBe(0);
  });

  it("reports zero skipped when everything scraped is still upcoming", async () => {
    mockScrape.mockResolvedValue({ ok: true, data: [EVENT_A] });
    const { client } = fakeSupabase();

    const result = await syncLiveEvents(client, { now: NOW });

    expect(result.eventsSkippedPast).toBe(0);
  });

  it("runs a dry run without writing anything", async () => {
    mockScrape.mockResolvedValue({ ok: true, data: [EVENT_A] });
    const { client, state } = fakeSupabase();

    const result = await syncLiveEvents(client, { now: NOW, dryRun: true });

    expect(state.upsertCalled).toBe(false);
    expect(state.updateCalled).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.eventsUpserted).toBe(1); // reports what WOULD be upserted
  });

  it("deactivates stale events when both scrapes succeed", async () => {
    mockScrape.mockResolvedValue({ ok: true, data: [EVENT_A] });
    const { client, state } = fakeSupabase({ deactivateCount: 2 });

    const result = await syncLiveEvents(client, { now: NOW });

    expect(state.updateCalled).toBe(true);
    expect(result.eventsDeactivated).toBe(2);
    expect(result.partial).toBe(false);
  });

  it("skips deactivation on a partial scrape, so a transient failure never hides real events", async () => {
    mockScrape
      .mockResolvedValueOnce({ ok: true, data: [EVENT_A] }) // today
      .mockResolvedValueOnce({ ok: false, reason: "timeout" }); // week
    const { client, state } = fakeSupabase();

    const result = await syncLiveEvents(client, { now: NOW });

    expect(result.partial).toBe(true);
    expect(state.updateCalled).toBe(false);
    expect(result.eventsDeactivated).toBe(0);
    // The successful half's data should still be upserted, not thrown away.
    expect(state.upsertCalled).toBe(true);
  });

  it("reports an upsert failure instead of claiming success", async () => {
    mockScrape.mockResolvedValue({ ok: true, data: [EVENT_A] });
    const { client } = fakeSupabase({ upsertError: "permission denied" });

    const result = await syncLiveEvents(client, { now: NOW });

    expect(result.error).toBe("permission denied");
  });

  it("reports a deactivation failure without losing the upsert count", async () => {
    mockScrape.mockResolvedValue({ ok: true, data: [EVENT_A] });
    const { client } = fakeSupabase({ updateError: "connection lost" });

    const result = await syncLiveEvents(client, { now: NOW });

    expect(result.error).toContain("connection lost");
    expect(result.eventsUpserted).toBe(1);
  });
});
