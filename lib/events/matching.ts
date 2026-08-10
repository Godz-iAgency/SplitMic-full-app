import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cross-references a scraped event's artist/venue name against existing,
 * published SplitMic profiles, so an event card can link straight to a
 * band's or venue's real profile when there is one.
 *
 * Runs at sync time (once/day), not at page-read time — the public page
 * stays a single fast query, and matching only needs to happen when the
 * underlying event data actually changes.
 *
 * Scope note: this only matches against real signed-up SplitMic profiles
 * (`profiles` + `band_details`/`venue_details`). The separate scraped
 * business-directory CSV is not imported into the database yet, so it isn't
 * available here — a future follow-up once that data lands in its own table.
 */

export type ProfileCandidate = { profileId: string; name: string };

export type MatchCandidates = {
  bands: ProfileCandidate[];
  venues: ProfileCandidate[];
};

export type ProfileMatch = {
  profileId: string;
  profileType: "band" | "venue";
};

/** Lowercase, trim, collapse internal whitespace, strip a leading "the ". */
export function normalizeNameForMatch(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^the\s+/, "");
}

/**
 * True if two names are the same act/venue: an exact match after
 * normalization, or one contains the other as a substring of at least 4
 * characters (guards against short names like "Mo" spuriously matching
 * "Mohawk"). Deliberately simple — no fuzzy-matching library.
 */
export function namesLikelyMatch(a: string, b: string): boolean {
  const na = normalizeNameForMatch(a);
  const nb = normalizeNameForMatch(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return shorter.length >= 4 && longer.includes(shorter);
}

/**
 * Loads every published band's and venue's name + profile id, for matching
 * against scraped events. One full scan per sync run — these tables are
 * small enough (published profiles only) that this is cheap daily.
 */
export async function loadMatchCandidates(
  supabase: SupabaseClient,
): Promise<MatchCandidates> {
  // Same two-step shape as lib/supabase/search.ts: published profile ids
  // first, then the per-type detail rows for those ids — proven against RLS
  // and the actual schema rather than a join syntax used nowhere else here.
  const [bandIds, venueIds] = await Promise.all([
    supabase.from("profiles").select("id").eq("player_type", "band").eq("is_published", true),
    supabase.from("profiles").select("id").eq("player_type", "venue").eq("is_published", true),
  ]);

  const bandProfileIds = (bandIds.data ?? []).map((row) => row.id as string);
  const venueProfileIds = (venueIds.data ?? []).map((row) => row.id as string);

  // .in("profile_id", []) is a no-op-but-still-a-round-trip on an empty list —
  // skip it outright rather than relying on that behavior.
  const [bandRows, venueRows] = await Promise.all([
    bandProfileIds.length
      ? supabase.from("band_details").select("profile_id, band_name").in("profile_id", bandProfileIds)
      : Promise.resolve({ data: [] as { profile_id: string; band_name: string }[] }),
    venueProfileIds.length
      ? supabase.from("venue_details").select("profile_id, venue_name").in("profile_id", venueProfileIds)
      : Promise.resolve({ data: [] as { profile_id: string; venue_name: string }[] }),
  ]);

  const bands: ProfileCandidate[] = (bandRows.data ?? [])
    .filter((row): row is { profile_id: string; band_name: string } =>
      Boolean(row.band_name),
    )
    .map((row) => ({ profileId: row.profile_id, name: row.band_name }));

  const venues: ProfileCandidate[] = (venueRows.data ?? [])
    .filter((row): row is { profile_id: string; venue_name: string } =>
      Boolean(row.venue_name),
    )
    .map((row) => ({ profileId: row.profile_id, name: row.venue_name }));

  return { bands, venues };
}

/**
 * Finds the best profile match for a scraped event. Bands are checked
 * before venues: a fan searching for a specific band cares more about that
 * band's SplitMic profile than the venue hosting it.
 */
export function findMatch(
  candidates: MatchCandidates,
  artistName: string,
  venueName: string,
): ProfileMatch | null {
  const band = candidates.bands.find((c) => namesLikelyMatch(c.name, artistName));
  if (band) return { profileId: band.profileId, profileType: "band" };

  const venue = candidates.venues.find((c) => namesLikelyMatch(c.name, venueName));
  if (venue) return { profileId: venue.profileId, profileType: "venue" };

  return null;
}
