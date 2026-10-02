import { describe, expect, it } from "vitest";
import { selectUpcomingOpportunities, memberSearchGenre, TOOL_DEFINITIONS } from "./tools";
import { buildSystemPrompt } from "./systemPrompt";
import type { MarketplaceCard } from "@/lib/supabase/marketplace";
import type { PlayerType } from "@/lib/types";

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

// Whether a genre filter applies to each member type. A Record, so a new
// player type can't be added without deciding.
const GENRE_APPLIES = {
  band: true,
  venue: true,
  talent_buyer: true,
  record_label: true,
  festival: true,
  backline: false,
  instrument_rental: false,
  rehearsal_studio: false,
} satisfies Record<PlayerType, boolean>;

describe("memberSearchGenre", () => {
  it.each(Object.entries(GENRE_APPLIES))("%s: genre applies = %s", (type, applies) => {
    expect(memberSearchGenre(type as PlayerType, "Rock")).toBe(applies ? "Rock" : undefined);
  });

  it("ignores a genre that isn't in the list, and an absent one", () => {
    expect(memberSearchGenre("band", "Not A Genre")).toBeUndefined();
    expect(memberSearchGenre("band", null)).toBeUndefined();
  });
});

describe("assistant instructions for gear and rehearsal businesses", () => {
  const members = TOOL_DEFINITIONS.find((t) => t.name === "search_splitmic_members")!;
  const enumValues = members.parameters.properties.player_type.enum ?? [];

  it("lets the model search every player type as a member", () => {
    expect([...enumValues].sort()).toEqual(Object.keys(GENRE_APPLIES).sort());
  });

  it("tells the model to search members before the directory", () => {
    const directory = TOOL_DEFINITIONS.find((t) => t.name === "search_austin_directory")!;
    expect(members.description).toMatch(/FIRST/);
    expect(directory.description).toMatch(/AFTER search_splitmic_members/);
    expect(directory.description).not.toMatch(/ONLY source/);
  });

  it("no longer claims these businesses are directory-only", () => {
    const prompt = buildSystemPrompt(null, new Date("2026-10-10T17:00:00Z"));
    expect(prompt).not.toMatch(/only in the directory/);
    expect(prompt).toMatch(/Search members first/);
  });
});
