import type { SupabaseClient } from "@supabase/supabase-js";
import { DRAW_ORDER, type ShowCriteria } from "@/lib/ai/showMatch";

const BUCKET = "profile-media";

/** How many bands the buyer gets back. Enough to choose from, few enough to read. */
export const MATCH_LIMIT = 12;

/**
 * Ceiling on how many published bands we score in memory. Austin-scoped and
 * band-only, so this covers the whole roster many times over; it exists so the
 * query can never grow unbounded.
 */
const SCAN_LIMIT = 400;

export type MatchCard = {
  profile_id: string;
  display_name: string;
  one_liner: string;
  genres: string[];
  avatar_url: string | null;
  /** Plain-English reasons this band surfaced, in the order they scored. */
  reasons: string[];
};

type BandRow = {
  profile_id: string;
  band_name: string | null;
  genres: unknown;
  sound_description: string | null;
  member_count: number | null;
  typical_draw: string | null;
};

// Weights are relative, not absolute: they only decide ordering within one
// result set. Genre is the strongest signal a buyer gives, draw is next
// (it is the number they actually have to justify), then size, then vibe words.
const WEIGHT_GENRE = 4;
const WEIGHT_DRAW = 3;
const WEIGHT_SIZE = 2;
const WEIGHT_KEYWORD = 1.5;

/**
 * Ranks published bands against a talent buyer's extracted criteria.
 *
 * Soft ranking, not hard filtering: a band that misses one criterion still
 * places below the ones that hit it instead of vanishing. Bands that match
 * nothing at all are dropped, so the shortlist never pads itself with
 * irrelevant profiles. Equal matches go to the most recently updated profile,
 * and with no criteria at all (the model gave us nothing usable) that recency
 * is the whole ordering: the same signal Discover sorts by, rather than a
 * judgment about which band is "better".
 */
export async function matchBands(
  supabase: SupabaseClient,
  criteria: ShowCriteria,
): Promise<MatchCard[]> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, updated_at")
    .eq("is_published", true)
    .eq("player_type", "band")
    .limit(SCAN_LIMIT);

  if (!profiles || profiles.length === 0) return [];

  const profileIds = profiles.map((p) => p.id as string);

  const [detailsResult, avatarsResult] = await Promise.all([
    supabase
      .from("band_details")
      .select(
        "profile_id, band_name, genres, sound_description, member_count, typical_draw",
      )
      .in("profile_id", profileIds),
    supabase
      .from("profile_media")
      .select("profile_id, storage_path")
      .eq("kind", "avatar")
      .in("profile_id", profileIds),
  ]);

  const detailMap = new Map<string, BandRow>();
  for (const d of (detailsResult.data ?? []) as BandRow[]) {
    detailMap.set(d.profile_id, d);
  }

  const avatarMap = new Map<string, string>();
  for (const a of avatarsResult.data ?? []) {
    avatarMap.set(a.profile_id as string, a.storage_path as string);
  }

  const hasCriteria =
    criteria.genres.length > 0 ||
    criteria.minDraw !== null ||
    criteria.maxMemberCount !== null ||
    criteria.keywords.length > 0;

  const scored: { card: MatchCard; score: number; updatedAt: number }[] = [];

  for (const p of profiles) {
    const detail = detailMap.get(p.id as string);
    if (!detail) continue; // profile row exists but the band never finished details

    const genres = toGenreList(detail.genres);
    const { score, reasons, genreHit } = scoreBand(detail, genres, criteria);

    // Genre is a gate, not a weight. When the buyer names genres, a band that
    // plays none of them is not a match no matter how well it does on draw or
    // vibe words — otherwise "solo acoustic brunch" returns 5-piece reggae
    // bands purely because they clear the crowd threshold.
    if (criteria.genres.length > 0 && !genreHit) continue;

    // Nothing in common with what the buyer asked for.
    if (hasCriteria && score === 0) continue;

    const storagePath = avatarMap.get(p.id as string) ?? null;
    const updatedAt = Date.parse((p.updated_at as string | null) ?? "");

    scored.push({
      score,
      updatedAt: Number.isNaN(updatedAt) ? 0 : updatedAt,
      card: {
        profile_id: p.id as string,
        display_name: detail.band_name ?? "Unnamed band",
        one_liner: detail.sound_description ?? "",
        genres,
        avatar_url: storagePath
          ? supabase.storage.from(BUCKET).getPublicUrl(storagePath).data
              .publicUrl
          : null,
        reasons,
      },
    });
  }

  scored.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
  return scored.slice(0, MATCH_LIMIT).map((s) => s.card);
}

function scoreBand(
  detail: BandRow,
  genres: string[],
  criteria: ShowCriteria,
): { score: number; reasons: string[]; genreHit: boolean } {
  let score = 0;
  const reasons: string[] = [];

  // ── Genre overlap ──────────────────────────────────────────────────────
  const matchedGenres = criteria.genres.filter((g) => genres.includes(g));
  if (matchedGenres.length > 0) {
    score += matchedGenres.length * WEIGHT_GENRE;
    reasons.push(`Plays ${matchedGenres.join(" and ")}`);
  }

  // ── Draw ───────────────────────────────────────────────────────────────
  if (criteria.minDraw) {
    const wanted = DRAW_ORDER.indexOf(criteria.minDraw);
    const actual = detail.typical_draw
      ? DRAW_ORDER.indexOf(detail.typical_draw)
      : -1;
    if (wanted >= 0 && actual >= wanted) {
      score += WEIGHT_DRAW;
      reasons.push(`Draws ${drawLabel(detail.typical_draw)}`);
    }
  }

  // ── Band size ──────────────────────────────────────────────────────────
  if (criteria.maxMemberCount !== null && detail.member_count !== null) {
    if (detail.member_count <= criteria.maxMemberCount) {
      score += WEIGHT_SIZE;
      reasons.push(
        detail.member_count === 1
          ? "Solo act"
          : `${detail.member_count}-piece`,
      );
    }
  }

  // ── Vibe keywords against the band's own sound description ─────────────
  const haystack = `${detail.sound_description ?? ""} ${detail.band_name ?? ""}`
    .toLowerCase();
  const matchedWords = criteria.keywords.filter((k) => haystack.includes(k));
  if (matchedWords.length > 0) {
    score += matchedWords.length * WEIGHT_KEYWORD;
    reasons.push(`Describes their sound as ${matchedWords.join(", ")}`);
  }

  return { score, reasons, genreHit: matchedGenres.length > 0 };
}

function drawLabel(value: string | null): string {
  switch (value) {
    case "0-25":
      return "up to 25";
    case "25-75":
      return "25 to 75";
    case "75-200":
      return "75 to 200";
    case "200+":
      return "200 or more";
    default:
      return "a crowd";
  }
}

function toGenreList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}
