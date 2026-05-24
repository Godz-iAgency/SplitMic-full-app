import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerType } from "@/lib/types";

const BUCKET = "profile-media";

export const MARKETPLACE_PAGE_SIZE = 24;

// Bands cannot post anything in the marketplace.
export const POSTING_PLAYER_TYPES: PlayerType[] = [
  "venue",
  "talent_buyer",
  "record_label",
  "festival",
];

// Only venues + festivals can post events. Everyone else is opportunity-only.
export const EVENT_POSTING_PLAYER_TYPES: PlayerType[] = ["venue", "festival"];

// Active-post limits, enforced before insert.
export const MAX_ACTIVE_EVENT_POSTS = 10;
export const MAX_ACTIVE_OPPORTUNITY_POSTS = 3;

// Max bands a venue/festival can tag on a single event post.
export const MAX_TAGGED_BANDS_PER_EVENT = 10;

export type PostType = "event" | "opportunity";

export type MarketplacePost = {
  id: string;
  poster_profile_id: string;
  poster_user_id: string;
  post_type: PostType;
  title: string;
  description: string | null;
  event_date: string | null;
  /** Multi-day events (festivals) — last day of the event. NULL for single-day events. */
  event_end_date: string | null;
  event_location: string | null;
  open_until: string | null;
  genres: string[];
  pay_info: string | null;
  player_types_wanted: string[];
  expires_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MarketplaceCard = MarketplacePost & {
  poster_name: string;
  poster_player_type: PlayerType;
  poster_avatar_url: string | null;
};

export type BrowseFilters = {
  postType?: PostType | "all";
  playerType?: PlayerType | "all";
  genre?: string;
  query?: string;
  offset?: number;
};

export type BrowseResult = {
  cards: MarketplaceCard[];
  hasMore: boolean;
};

/**
 * Browse marketplace posts. Always filters out expired/inactive posts.
 * Sort: newest first.
 */
export async function browseMarketplace(
  supabase: SupabaseClient,
  filters: BrowseFilters = {},
): Promise<BrowseResult> {
  const offset = filters.offset ?? 0;
  const limit = MARKETPLACE_PAGE_SIZE;
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("marketplace_posts")
    .select(
      "id, poster_profile_id, poster_user_id, post_type, title, description, event_date, event_end_date, event_location, open_until, genres, pay_info, player_types_wanted, expires_at, is_active, created_at, updated_at",
    )
    .eq("is_active", true)
    .gte("expires_at", today)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (filters.postType && filters.postType !== "all") {
    query = query.eq("post_type", filters.postType);
  }

  if (filters.genre) {
    query = query.overlaps("genres", [filters.genre]);
  }

  if (filters.query?.trim()) {
    query = query.ilike("title", `%${filters.query.trim()}%`);
  }

  const { data: posts, error } = await query;
  if (error || !posts || posts.length === 0) {
    return { cards: [], hasMore: false };
  }

  const hasMore = posts.length > limit;
  const trimmed = hasMore ? posts.slice(0, limit) : posts;

  // Optional poster player_type filter — apply after fetch since it lives on profiles.
  const posterIds = Array.from(new Set(trimmed.map((p) => p.poster_profile_id)));

  const [{ data: posterProfiles }, posterDetailMap, posterAvatarMap] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, player_type")
        .in("id", posterIds),
      fetchPosterNames(supabase, posterIds),
      fetchPosterAvatars(supabase, posterIds),
    ]);

  const posterTypeById = new Map<string, PlayerType>();
  for (const p of posterProfiles ?? []) {
    posterTypeById.set(p.id, p.player_type as PlayerType);
  }

  let cards: MarketplaceCard[] = trimmed.map((p) => ({
    ...(p as MarketplacePost),
    poster_name: posterDetailMap.get(p.poster_profile_id) ?? "Austin player",
    poster_player_type:
      (posterTypeById.get(p.poster_profile_id) as PlayerType) ?? "venue",
    poster_avatar_url: posterAvatarMap.get(p.poster_profile_id) ?? null,
  }));

  if (filters.playerType && filters.playerType !== "all") {
    cards = cards.filter((c) => c.poster_player_type === filters.playerType);
  }

  return { cards, hasMore };
}

/** Fetch the display name for each poster profile (per-type detail row). */
async function fetchPosterNames(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (profileIds.length === 0) return map;

  const queries = await Promise.all([
    supabase
      .from("venue_details")
      .select("profile_id, venue_name")
      .in("profile_id", profileIds),
    supabase
      .from("talent_buyer_details")
      .select("profile_id, company_name")
      .in("profile_id", profileIds),
    supabase
      .from("record_label_details")
      .select("profile_id, label_name")
      .in("profile_id", profileIds),
    supabase
      .from("festival_details")
      .select("profile_id, festival_name")
      .in("profile_id", profileIds),
    supabase
      .from("band_details")
      .select("profile_id, band_name")
      .in("profile_id", profileIds),
  ]);

  for (const row of queries[0].data ?? [])
    map.set(row.profile_id, row.venue_name ?? "Venue");
  for (const row of queries[1].data ?? [])
    map.set(row.profile_id, row.company_name ?? "Talent buyer");
  for (const row of queries[2].data ?? [])
    map.set(row.profile_id, row.label_name ?? "Record label");
  for (const row of queries[3].data ?? [])
    map.set(row.profile_id, row.festival_name ?? "Festival");
  for (const row of queries[4].data ?? [])
    map.set(row.profile_id, row.band_name ?? "Band");

  return map;
}

async function fetchPosterAvatars(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (profileIds.length === 0) return map;

  const { data } = await supabase
    .from("profile_media")
    .select("profile_id, storage_path")
    .eq("kind", "avatar")
    .in("profile_id", profileIds);

  for (const a of data ?? []) {
    const url = supabase.storage.from(BUCKET).getPublicUrl(a.storage_path)
      .data.publicUrl;
    map.set(a.profile_id, url);
  }
  return map;
}

/** Single post + poster name + tagged bands (for detail page). */
export async function getPostDetail(
  supabase: SupabaseClient,
  postId: string,
): Promise<{
  post: MarketplaceCard | null;
  taggedBands: TaggedBand[];
}> {
  const { data: post } = await supabase
    .from("marketplace_posts")
    .select(
      "id, poster_profile_id, poster_user_id, post_type, title, description, event_date, event_end_date, event_location, open_until, genres, pay_info, player_types_wanted, expires_at, is_active, created_at, updated_at",
    )
    .eq("id", postId)
    .maybeSingle();

  if (!post) return { post: null, taggedBands: [] };

  const [nameMap, avatarMap, profileTypeRow] = await Promise.all([
    fetchPosterNames(supabase, [post.poster_profile_id]),
    fetchPosterAvatars(supabase, [post.poster_profile_id]),
    supabase
      .from("profiles")
      .select("player_type")
      .eq("id", post.poster_profile_id)
      .maybeSingle(),
  ]);

  const card: MarketplaceCard = {
    ...(post as MarketplacePost),
    poster_name: nameMap.get(post.poster_profile_id) ?? "Austin player",
    poster_player_type:
      (profileTypeRow.data?.player_type as PlayerType) ?? "venue",
    poster_avatar_url: avatarMap.get(post.poster_profile_id) ?? null,
  };

  const taggedBands = await getTaggedBandsForPost(supabase, postId);
  return { post: card, taggedBands };
}

export type TaggedBand = {
  tag_id: string;
  band_profile_id: string;
  status: "pending" | "accepted" | "declined";
  shared_to_feed: boolean;
  band_name: string;
  band_avatar_url: string | null;
};

/** Bands tagged on an event — used on the detail page lineup card. */
export async function getTaggedBandsForPost(
  supabase: SupabaseClient,
  postId: string,
): Promise<TaggedBand[]> {
  const { data: tags } = await supabase
    .from("event_band_tags")
    .select("id, band_profile_id, status, shared_to_feed")
    .eq("marketplace_post_id", postId);

  if (!tags || tags.length === 0) return [];

  const ids = tags.map((t) => t.band_profile_id);
  const [{ data: bandRows }, avatarMap] = await Promise.all([
    supabase
      .from("band_details")
      .select("profile_id, band_name")
      .in("profile_id", ids),
    fetchPosterAvatars(supabase, ids),
  ]);

  const bandNameById = new Map<string, string>();
  for (const b of bandRows ?? []) {
    bandNameById.set(b.profile_id, b.band_name ?? "Band");
  }

  return tags.map((t) => ({
    tag_id: t.id,
    band_profile_id: t.band_profile_id,
    status: t.status as "pending" | "accepted" | "declined",
    shared_to_feed: t.shared_to_feed,
    band_name: bandNameById.get(t.band_profile_id) ?? "Band",
    band_avatar_url: avatarMap.get(t.band_profile_id) ?? null,
  }));
}

/** Search bands by name for the tag-picker (event post creation). */
export type BandSearchResult = {
  profile_id: string;
  band_name: string;
  avatar_url: string | null;
};

export async function searchBandsForTagging(
  supabase: SupabaseClient,
  query: string,
  limit = 8,
): Promise<BandSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data: bandRows } = await supabase
    .from("band_details")
    .select("profile_id, band_name")
    .ilike("band_name", `%${trimmed}%`)
    .limit(limit);

  if (!bandRows || bandRows.length === 0) return [];

  // Filter to published bands only
  const ids = bandRows.map((b) => b.profile_id);
  const { data: publishedProfiles } = await supabase
    .from("profiles")
    .select("id")
    .in("id", ids)
    .eq("is_published", true);

  const publishedSet = new Set((publishedProfiles ?? []).map((p) => p.id));
  const filtered = bandRows.filter((b) => publishedSet.has(b.profile_id));

  const avatarMap = await fetchPosterAvatars(
    supabase,
    filtered.map((b) => b.profile_id),
  );

  return filtered.map((b) => ({
    profile_id: b.profile_id,
    band_name: b.band_name ?? "Band",
    avatar_url: avatarMap.get(b.profile_id) ?? null,
  }));
}

/** Count active posts (non-expired) by post_type for limit enforcement. */
export async function countActivePosts(
  supabase: SupabaseClient,
  posterProfileId: string,
  postType: PostType,
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from("marketplace_posts")
    .select("id", { count: "exact", head: true })
    .eq("poster_profile_id", posterProfileId)
    .eq("post_type", postType)
    .eq("is_active", true)
    .gte("expires_at", today);

  return count ?? 0;
}

/**
 * Posts the logged-in user has been tagged on (for "My events" / band notifications).
 */
export async function getEventTagsForBand(
  supabase: SupabaseClient,
  bandProfileId: string,
): Promise<
  Array<{
    tag_id: string;
    status: "pending" | "accepted" | "declined";
    shared_to_feed: boolean;
    post: MarketplaceCard;
  }>
> {
  const { data: tags } = await supabase
    .from("event_band_tags")
    .select("id, status, shared_to_feed, marketplace_post_id")
    .eq("band_profile_id", bandProfileId)
    .order("created_at", { ascending: false });

  if (!tags || tags.length === 0) return [];

  const postIds = tags.map((t) => t.marketplace_post_id);
  const { data: posts } = await supabase
    .from("marketplace_posts")
    .select(
      "id, poster_profile_id, poster_user_id, post_type, title, description, event_date, event_end_date, event_location, open_until, genres, pay_info, player_types_wanted, expires_at, is_active, created_at, updated_at",
    )
    .in("id", postIds);

  if (!posts || posts.length === 0) return [];

  const posterIds = Array.from(new Set(posts.map((p) => p.poster_profile_id)));
  const [nameMap, avatarMap, { data: typeRows }] = await Promise.all([
    fetchPosterNames(supabase, posterIds),
    fetchPosterAvatars(supabase, posterIds),
    supabase.from("profiles").select("id, player_type").in("id", posterIds),
  ]);
  const typeMap = new Map<string, PlayerType>();
  for (const r of typeRows ?? [])
    typeMap.set(r.id, r.player_type as PlayerType);

  const postById = new Map<string, MarketplaceCard>();
  for (const p of posts) {
    postById.set(p.id, {
      ...(p as MarketplacePost),
      poster_name: nameMap.get(p.poster_profile_id) ?? "Austin player",
      poster_player_type: typeMap.get(p.poster_profile_id) ?? "venue",
      poster_avatar_url: avatarMap.get(p.poster_profile_id) ?? null,
    });
  }

  return tags
    .map((t) => {
      const post = postById.get(t.marketplace_post_id);
      if (!post) return null;
      return {
        tag_id: t.id,
        status: t.status as "pending" | "accepted" | "declined",
        shared_to_feed: t.shared_to_feed,
        post,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/**
 * Format a timestamp as relative time: "just now", "3m ago", "2h ago",
 * "Yesterday", "3d ago", or falls back to "Jul 15" for older posts.
 * Used to give the feed a social, alive feel.
 */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;

  // Older posts: show the date
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Format a date for display: "Jul 15, 2026" */
export function formatPostDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00"); // anchor at noon to avoid TZ shift
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a single-day or multi-day event date for display.
 * - Single day:  "Jul 15, 2026"
 * - Same month:  "Jul 15 – 18, 2026"
 * - Cross-month: "Jul 30 – Aug 2, 2026"
 * - Cross-year:  "Dec 30, 2026 – Jan 2, 2027"
 */
export function formatEventDateRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string {
  if (!startIso) return "";
  if (!endIso || endIso === startIso) return formatPostDate(startIso);

  const start = new Date(startIso + "T12:00:00");
  const end = new Date(endIso + "T12:00:00");

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    // "Jul 15 – 18, 2026"
    const month = start.toLocaleDateString("en-US", { month: "short" });
    return `${month} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  }

  if (sameYear) {
    // "Jul 30 – Aug 2, 2026"
    const startStr = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endStr = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${startStr} – ${endStr}, ${start.getFullYear()}`;
  }

  // Cross-year — full dates on both sides
  return `${formatPostDate(startIso)} – ${formatPostDate(endIso)}`;
}

export function isPostingPlayerType(t: PlayerType): boolean {
  return POSTING_PLAYER_TYPES.includes(t);
}

export function canPostEvents(t: PlayerType): boolean {
  return EVENT_POSTING_PLAYER_TYPES.includes(t);
}
