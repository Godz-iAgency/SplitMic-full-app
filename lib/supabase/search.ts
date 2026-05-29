import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerType } from "@/lib/types";

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

  // 1. Fetch matching profiles (id + player_type), 1 extra row to detect hasMore
  let query = supabase
    .from("profiles")
    .select("id, player_type, updated_at, created_at")
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

  const detailMap = new Map<
    string,
    { name: string; oneLiner: string; genres: string[] }
  >();
  for (const m of detailMaps) {
    for (const [id, data] of m) detailMap.set(id, data);
  }

  const avatarMap = new Map<string, string>();
  for (const a of avatarsResult.data ?? []) {
    avatarMap.set(a.profile_id, a.storage_path);
  }

  const cards: SearchCard[] = profiles.map((p) => {
    const detail = detailMap.get(p.id);
    const storagePath = avatarMap.get(p.id) ?? null;
    return {
      profile_id: p.id,
      player_type: p.player_type as PlayerType,
      display_name: detail?.name ?? "Austin player",
      one_liner: detail?.oneLiner ?? "",
      genres: detail?.genres ?? [],
      avatar_url: storagePath
        ? supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
        : null,
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
): Promise<Map<string, { name: string; oneLiner: string; genres: string[] }>> {
  const map = new Map<
    string,
    { name: string; oneLiner: string; genres: string[] }
  >();
  if (ids.length === 0) return map;

  switch (type) {
    case "band": {
      const { data } = await supabase
        .from("band_details")
        .select("profile_id, band_name, sound_description, genres")
        .in("profile_id", ids);
      for (const d of data ?? []) {
        map.set(d.profile_id, {
          name: d.band_name ?? "Unnamed band",
          oneLiner: d.sound_description ?? "",
          genres: toGenreList(d.genres),
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
