import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerType } from "@/lib/types";
import {
  computeBandReadiness,
  type BandScoreInput,
} from "@/lib/scoring/bandReadiness";

const BUCKET = "profile-media";

// 24 fits cleanly in 1/2/3-column grids (mobile/tablet/desktop) — no orphaned cards.
export const SEARCH_PAGE_SIZE = 24;

export type SortOption = "newest" | "recent";

export type SearchCard = {
  profile_id: string;
  player_type: PlayerType;
  display_name: string;
  one_liner: string;
  genres: string[];
  avatar_url: string | null;
  /** Band Readiness Score (bands only); null for other player types. */
  readiness_score: number | null;
};

// The band_details columns needed to score a band card (everything except the
// fields that live on the profiles row / media, which are merged in separately).
type BandScoreFields = Omit<
  BandScoreInput,
  "bio" | "instagram_followers" | "hasAvatar"
>;

type DetailValue = {
  name: string;
  oneLiner: string;
  genres: string[];
  bandScore?: BandScoreFields;
};

export type SearchFilters = {
  playerType: PlayerType | "all";
  offset?: number;
  query?: string;
  genre?: string;
  sort?: SortOption;
};

export type SearchResult = {
  cards: SearchCard[];
  hasMore: boolean;
};

const ALL_PLAYER_TYPES: PlayerType[] = [
  "band",
  "venue",
  "talent_buyer",
  "record_label",
  "festival",
];

/**
 * Searches all published profiles, returning lightweight cards for the search grid.
 * Default behavior: only `is_published = true` rows are returned (RLS gates this too).
 *
 * Pagination: offset-based for now. We fetch `SEARCH_PAGE_SIZE + 1` rows to detect
 * whether there are more results without a separate count query.
 *
 * Filters supported:
 *   - playerType: "all" or specific type
 *   - query: case-insensitive partial match against display name
 *   - genre: matches if profile's genre array overlaps with this single value
 *   - sort: "newest" (updated_at) | "recent" (created_at)
 */
export async function searchProfiles(
  supabase: SupabaseClient,
  filters: SearchFilters,
): Promise<SearchResult> {
  const offset = filters.offset ?? 0;
  const limit = SEARCH_PAGE_SIZE;
  const sort: SortOption = filters.sort ?? "newest";

  const trimmedQuery = filters.query?.trim() ?? "";
  const genre = filters.genre ?? "";

  // Determine which detail tables to query for name/genre filters
  const typesToConsider =
    filters.playerType === "all" ? ALL_PLAYER_TYPES : [filters.playerType];

  // If a query or genre is set, find matching profile IDs from detail tables first
  let restrictToIds: string[] | null = null;
  if (trimmedQuery || genre) {
    restrictToIds = await getMatchingProfileIds(
      supabase,
      typesToConsider,
      trimmedQuery,
      genre,
    );
    if (restrictToIds.length === 0) {
      return { cards: [], hasMore: false };
    }
  }

  // 1. Fetch matching profiles (id + player_type), 1 extra row to detect hasMore.
  //    bio + instagram_followers are pulled in for band readiness scoring.
  let query = supabase
    .from("profiles")
    .select("id, player_type, updated_at, created_at, bio, instagram_followers")
    .eq("is_published", true);

  if (filters.playerType !== "all") {
    query = query.eq("player_type", filters.playerType);
  }

  if (restrictToIds !== null) {
    query = query.in("id", restrictToIds);
  }

  // Sort
  const sortColumn = sort === "recent" ? "created_at" : "updated_at";
  query = query
    .order(sortColumn, { ascending: false })
    .range(offset, offset + limit); // inclusive — returns limit+1 rows

  const { data: rawProfiles, error } = await query;
  if (error || !rawProfiles || rawProfiles.length === 0) {
    return { cards: [], hasMore: false };
  }

  const hasMore = rawProfiles.length > limit;
  const profiles = hasMore ? rawProfiles.slice(0, limit) : rawProfiles;
  const profileIds = profiles.map((p) => p.id);

  // 2. Group profile IDs by player_type so we can batch-fetch detail rows
  const idsByType = new Map<PlayerType, string[]>();
  for (const p of profiles) {
    const t = p.player_type as PlayerType;
    if (!idsByType.has(t)) idsByType.set(t, []);
    idsByType.get(t)!.push(p.id);
  }

  // 3. Fetch detail rows + avatars in parallel
  const detailFetches = Array.from(idsByType.entries()).map(([type, ids]) =>
    fetchDetailsForType(supabase, type, ids),
  );

  const [detailMaps, avatarsResult] = await Promise.all([
    Promise.all(detailFetches),
    supabase
      .from("profile_media")
      .select("profile_id, storage_path")
      .eq("kind", "avatar")
      .in("profile_id", profileIds),
  ]);

  const detailMap = new Map<string, DetailValue>();
  for (const m of detailMaps) {
    for (const [id, data] of m) detailMap.set(id, data);
  }

  const avatarMap = new Map<string, string>();
  for (const a of avatarsResult.data ?? []) {
    avatarMap.set(a.profile_id, a.storage_path);
  }

  // Per-profile fields needed for band scoring (bio + Instagram reach).
  const metaMap = new Map<
    string,
    { bio: string | null; instagram_followers: number | null }
  >();
  for (const p of profiles) {
    metaMap.set(p.id, {
      bio: p.bio ?? null,
      instagram_followers: p.instagram_followers ?? null,
    });
  }

  const cards: SearchCard[] = profiles.map((p) => {
    const detail = detailMap.get(p.id);
    const storagePath = avatarMap.get(p.id) ?? null;

    // Bands get a public readiness score; everyone else is null.
    let readiness_score: number | null = null;
    if (p.player_type === "band" && detail?.bandScore) {
      const meta = metaMap.get(p.id);
      readiness_score = computeBandReadiness({
        bio: meta?.bio ?? null,
        instagram_followers: meta?.instagram_followers ?? null,
        hasAvatar: avatarMap.has(p.id),
        ...detail.bandScore,
      }).score;
    }

    return {
      profile_id: p.id,
      player_type: p.player_type as PlayerType,
      display_name: detail?.name ?? "Austin player",
      one_liner: detail?.oneLiner ?? "",
      genres: detail?.genres ?? [],
      avatar_url: storagePath
        ? supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
        : null,
      readiness_score,
    };
  });

  return { cards, hasMore };
}

/**
 * Counts published profiles per player type (plus an "all" total) for the
 * category browse tiles. One lightweight head+count query per type, run in
 * parallel — scales fine and never transfers row data.
 */
export async function getProfileCountsByType(
  supabase: SupabaseClient,
): Promise<Record<PlayerType | "all", number>> {
  const fetches = ALL_PLAYER_TYPES.map(async (t) => {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .eq("player_type", t);
    return [t, count ?? 0] as const;
  });

  const results = await Promise.all(fetches);

  const counts = {
    all: 0,
    band: 0,
    venue: 0,
    talent_buyer: 0,
    record_label: 0,
    festival: 0,
  } as Record<PlayerType | "all", number>;

  let total = 0;
  for (const [t, c] of results) {
    counts[t] = c;
    total += c;
  }
  counts.all = total;
  return counts;
}

// ── Per-type detail config (which tables/columns hold name + genre) ──────────

type DetailConfig = {
  table: string;
  nameColumn: string;
  genreColumn: string;
};

function getDetailTableConfig(type: PlayerType): DetailConfig {
  switch (type) {
    case "band":
      return {
        table: "band_details",
        nameColumn: "band_name",
        genreColumn: "genres",
      };
    case "venue":
      return {
        table: "venue_details",
        nameColumn: "venue_name",
        genreColumn: "genres_hosted",
      };
    case "talent_buyer":
      return {
        table: "talent_buyer_details",
        nameColumn: "company_name",
        genreColumn: "genres_focus",
      };
    case "record_label":
      return {
        table: "record_label_details",
        nameColumn: "label_name",
        genreColumn: "genres_focus",
      };
    case "festival":
      return {
        table: "festival_details",
        nameColumn: "festival_name",
        genreColumn: "genres_featured",
      };
  }
}

// ── Pre-filter: fetch profile IDs from detail tables matching query/genre ──

async function getMatchingProfileIds(
  supabase: SupabaseClient,
  types: PlayerType[],
  query: string,
  genre: string,
): Promise<string[]> {
  const fetches = types.map((t) =>
    fetchMatchingIdsForType(supabase, t, query, genre),
  );
  const results = await Promise.all(fetches);
  // Union of IDs (dedupe)
  return Array.from(new Set(results.flat()));
}

async function fetchMatchingIdsForType(
  supabase: SupabaseClient,
  type: PlayerType,
  query: string,
  genre: string,
): Promise<string[]> {
  const config = getDetailTableConfig(type);
  let q = supabase.from(config.table).select("profile_id");

  if (query) {
    q = q.ilike(config.nameColumn, `%${query}%`);
  }

  if (genre) {
    // overlaps: matches if column array shares any element with the array we pass
    q = q.overlaps(config.genreColumn, [genre]);
  }

  const { data } = await q;
  return (data ?? []).map((d) => d.profile_id as string);
}

// ── Per-type detail fetchers (for building cards) ───────────────────────────

async function fetchDetailsForType(
  supabase: SupabaseClient,
  type: PlayerType,
  ids: string[],
): Promise<Map<string, DetailValue>> {
  const map = new Map<string, DetailValue>();
  if (ids.length === 0) return map;

  switch (type) {
    case "band": {
      const { data } = await supabase
        .from("band_details")
        .select(
          "profile_id, band_name, sound_description, genres, set_length_minutes, email_list_size, typical_draw, largest_venue_capacity, tiktok_followers, youtube_followers",
        )
        .in("profile_id", ids);
      for (const d of data ?? []) {
        map.set(d.profile_id, {
          name: d.band_name ?? "Unnamed band",
          oneLiner: d.sound_description ?? "",
          genres: toGenreList(d.genres),
          bandScore: {
            genres: toGenreList(d.genres),
            sound_description: d.sound_description ?? null,
            set_length_minutes: d.set_length_minutes ?? null,
            email_list_size: d.email_list_size ?? null,
            typical_draw: d.typical_draw ?? null,
            largest_venue_capacity: d.largest_venue_capacity ?? null,
            tiktok_followers: d.tiktok_followers ?? null,
            youtube_followers: d.youtube_followers ?? null,
          },
        });
      }
      break;
    }
    case "venue": {
      const { data } = await supabase
        .from("venue_details")
        .select("profile_id, venue_name, venue_type, genres_hosted")
        .in("profile_id", ids);
      for (const d of data ?? []) {
        map.set(d.profile_id, {
          name: d.venue_name ?? "Unnamed venue",
          oneLiner: labelize(d.venue_type) ?? "Venue",
          genres: toGenreList(d.genres_hosted),
        });
      }
      break;
    }
    case "talent_buyer": {
      const { data } = await supabase
        .from("talent_buyer_details")
        .select("profile_id, company_name, company_type, genres_focus")
        .in("profile_id", ids);
      for (const d of data ?? []) {
        map.set(d.profile_id, {
          name: d.company_name ?? "Talent buyer",
          oneLiner: labelize(d.company_type) ?? "Talent buyer",
          genres: toGenreList(d.genres_focus),
        });
      }
      break;
    }
    case "record_label": {
      const { data } = await supabase
        .from("record_label_details")
        .select("profile_id, label_name, label_type, genres_focus")
        .in("profile_id", ids);
      for (const d of data ?? []) {
        map.set(d.profile_id, {
          name: d.label_name ?? "Record label",
          oneLiner: labelize(d.label_type) ?? "Record label",
          genres: toGenreList(d.genres_focus),
        });
      }
      break;
    }
    case "festival": {
      const { data } = await supabase
        .from("festival_details")
        .select("profile_id, festival_name, festival_type, genres_featured")
        .in("profile_id", ids);
      for (const d of data ?? []) {
        map.set(d.profile_id, {
          name: d.festival_name ?? "Festival",
          oneLiner: labelize(d.festival_type) ?? "Festival",
          genres: toGenreList(d.genres_featured),
        });
      }
      break;
    }
  }

  return map;
}

// Normalize a genre column (text[] or null) into a clean string array.
function toGenreList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

// Convert snake_case → "Title Case": "all_ages" → "All ages"
function labelize(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
