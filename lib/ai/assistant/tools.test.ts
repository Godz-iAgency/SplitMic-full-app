import { describe, expect, it } from "vitest";
import { selectUpcomingOpportunities } from "./tools";
import type { MarketplaceCard } from "@/lib/supabase/marketplace";

// Midday Austin time on 2026-10-10, well clear of the 9am cycle boundary.
const NOW = new Date("2026-10-10T17:00:00Z");

function post(overrides: Partial<MarketplaceCard>): MarketplaceCard {
  return {
    id: "p1",
    poster_profile_id: "prof-1",
    poster_user_id: "user-1",
    post_type: "event",
    title: "Show",
    description: null,
    event_date: "2026-10-12",
    event_end_date: null,
    event_location: "Austin",
    open_until: null,
    genres: [],
    pay_info: null,
    player_types_wanted: [],
    expires_at: "2026-10-19",
    is_active: true,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    poster_name: "QA Venue",
    poster_player_type: "venue",
    poster_avatar_url: null,
    ...overrides,
  };
}

describe("selectUpcomingOpportunities", () => {
  it("drops an event whose date has passed even though the feed still shows it", () => {
    // The feed keeps posts a week past their date; "any open mics this week"
    // must not answer with last Tuesday's.
    const past = post({ id: "past", event_date: "2026-10-08" });
    const future = post({ id: "future", event_date: "2026-10-12" });
    expect(selectUpcomingOpportunities([past, future], NOW).map((p) => p.id)).toEqual([
      "future",
    ]);
  });

  it("keeps an event happening today", () => {
    const today = post({ event_date: "2026-10-10" });
    expect(selectUpcomingOpportunities([today], NOW)).toHaveLength(1);
  });

  it("keeps a multi-day event that started earlier but is still running", () => {
    const festival = post({ event_date: "2026-10-08", event_end_date: "2026-10-11" });
    expect(selectUpcomingOpportunities([festival], NOW)).toHaveLength(1);
  });

  it("judges an opportunity by its open_until date", () => {
    const closed = post({ id: "closed", post_type: "opportunity", event_date: null, open_until: "2026-10-09" });
    const open = post({ id: "open", post_type: "opportunity", event_date: null, open_until: "2026-10-20" });
    expect(selectUpcomingOpportunities([closed, open], NOW).map((p) => p.id)).toEqual([
      "open",
    ]);
  });

  it("drops band re-shares so each post appears once, as its original", () => {
    const original = post({ id: "e1" });
    const reshare = post({ id: "e1", shared_by_profile_id: "band-1", feed_key: "e1::band-1" });
    const result = selectUpcomingOpportunities([original, reshare], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].shared_by_profile_id).toBeUndefined();
  });

  it("keeps a post with no date, since nothing says it has passed", () => {
    const undated = post({ post_type: "opportunity", event_date: null, open_until: null });
    expect(selectUpcomingOpportunities([undated], NOW)).toHaveLength(1);
  });
});
