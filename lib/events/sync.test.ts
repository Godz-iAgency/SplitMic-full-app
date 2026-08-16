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
  loadDirectoryVenueCandidates: vi.fn().mockResolvedValue([]),
  findDirectoryVenueMatch: vi.fn().mockReturnValue(null),
}));

import {
  scrapeDo512Events,
  DO512_TODAY_URL,
  DO512_WEEK_URL,
  DO512_WEEKDAY_LOOKAHEAD_DAYS,
  buildUpcomingDo512DateUrls,
} from "./do512";
import { findDirectoryVenueMatch } from "./matching";
import { syncLiveEvents } from "./sync";

const mockScrape = vi.mocked(scrapeDo512Events);
const mockFindDirectoryVenueMatch = vi.mocked(findDirectoryVenueMatch);

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
  mockFindDirectoryVenueMatch.mockReset().mockReturnValue(null);
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
      .mockResolvedValueOnce({ ok: false, reason: "timeout" }) // week
      .mockResolvedValue({ ok: true, data: [] }); // the 6 weekday date pages
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

  describe("weekday date-page coverage", () => {
    // Regression guard for a real incident: neither the "today" page nor the
    // "weekend" page reaches Mon-Thu, so "This Week" sat empty on a Sunday
    // afternoon even though real shows existed later that week.
    it("scrapes today, weekend, and one page per upcoming weekday", async () => {
      mockScrape.mockResolvedValue({ ok: true, data: [] });
      const { client } = fakeSupabase();

      await syncLiveEvents(client, { now: NOW });

      expect(mockScrape).toHaveBeenCalledTimes(2 + DO512_WEEKDAY_LOOKAHEAD_DAYS);
    });

    it("scrapes exactly today + weekend + the expected dated URLs, in order", async () => {
      mockScrape.mockResolvedValue({ ok: true, data: [] });
      const { client } = fakeSupabase();

      await syncLiveEvents(client, { now: NOW });

      const calledUrls = mockScrape.mock.calls.map((args) => args[0]);
      expect(calledUrls[0]).toBe(DO512_TODAY_URL);
      expect(calledUrls[1]).toBe(DO512_WEEK_URL);
      expect(calledUrls.slice(2)).toEqual(buildUpcomingDo512DateUrls(NOW));
    });

    it("treats a failure on any single weekday page as partial, not just today/weekend", async () => {
      mockScrape
        .mockResolvedValueOnce({ ok: true, data: [EVENT_A] }) // today
        .mockResolvedValueOnce({ ok: true, data: [] }) // weekend
        .mockResolvedValueOnce({ ok: true, data: [] }) // weekday +1
        .mockResolvedValueOnce({ ok: false, reason: "timeout" }) // weekday +2
        .mockResolvedValue({ ok: true, data: [] }); // remaining weekday pages
      const { client, state } = fakeSupabase();

      const result = await syncLiveEvents(client, { now: NOW });

      expect(result.partial).toBe(true);
      expect(state.updateCalled).toBe(false);
      // The successful pages' data is still upserted, not thrown away.
      expect(state.upsertCalled).toBe(true);
    });

    it("never has more than 2 scrapes in flight at once", async () => {
      // Regression guard for a real incident: running all 8 scrapes fully
      // concurrently overwhelmed Firecrawl and 6 of 8 timed out in a real
      // test against the live API; fully sequential fixed reliability but
      // took ~90s, longer than Vercel Hobby's 60s function limit. Concurrency
      // 2 was the fastest setting that stayed reliable — this proves the
      // sync actually honors that cap rather than silently reverting to
      // unlimited Promise.all.
      let inFlight = 0;
      let maxInFlight = 0;
      mockScrape.mockImplementation(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return { ok: true, data: [] };
      });
      const { client } = fakeSupabase();

      await syncLiveEvents(client, { now: NOW });

      expect(maxInFlight).toBeLessThanOrEqual(2);
      expect(mockScrape).toHaveBeenCalledTimes(2 + DO512_WEEKDAY_LOOKAHEAD_DAYS);
    });

    it("still fails closed when every page fails, including all weekday pages", async () => {
      mockScrape.mockResolvedValue({ ok: false, reason: "down" });
      const { client, state } = fakeSupabase();

      const result = await syncLiveEvents(client, { now: NOW });

      expect(result.error).toContain("down");
      expect(state.upsertCalled).toBe(false);
      expect(state.updateCalled).toBe(false);
    });
  });

  it("attaches a matched directory venue independently of the profile match", async () => {
    // Computed regardless of findMatch's result (mocked null throughout this
    // file) — a band matching the artist must not suppress the venue lookup.
    mockScrape.mockResolvedValue({ ok: true, data: [EVENT_A] });
    mockFindDirectoryVenueMatch.mockReturnValue("biz-1");
    const { client, state } = fakeSupabase();

    await syncLiveEvents(client, { now: NOW });

    expect((state.upsertRows[0] as { matched_directory_business_id: unknown }).matched_directory_business_id).toBe(
      "biz-1",
    );
  });

  it("sets matched_directory_business_id to null when nothing matches", async () => {
    mockScrape.mockResolvedValue({ ok: true, data: [EVENT_A] });
    const { client, state } = fakeSupabase();

    await syncLiveEvents(client, { now: NOW });

    expect((state.upsertRows[0] as { matched_directory_business_id: unknown }).matched_directory_business_id).toBeNull();
  });
});
