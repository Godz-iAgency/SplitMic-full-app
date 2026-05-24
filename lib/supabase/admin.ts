import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerType } from "@/lib/types";

// ─── Admin identity ─────────────────────────────────────────────────────────
// Single hardcoded admin email. Add more here if you onboard co-admins later.
export const ADMIN_EMAILS = ["christopher@godz-iagency.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type AdminStats = {
  totalUsers: number;
  byPlayerType: Record<PlayerType | "none", number>;
  publishedProfiles: number;
  unpublishedProfiles: number;
  suspendedProfiles: number;
  activeMarketplacePosts: number;
  totalConnectionRequests: number;
  pendingRequests: number;
  totalThreads: number;
  totalMessages: number;
  signupsThisWeek: number;
};

export type AdminUserRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  profile_id: string | null;
  player_type: PlayerType | null;
  display_name: string;
  is_published: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
};

export type AdminUserDetail = AdminUserRow & {
  bio: string | null;
  phone_number: string | null;
  website_url: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  street_address: string | null;
  instagram_handle: string | null;
  instagram_followers: number | null;
  active_post_count: number;
  incoming_request_count: number;
  outgoing_request_count: number;
  thread_count: number;
};

export type AdminPostRow = {
  post_id: string;
  title: string;
  post_type: "event" | "opportunity";
  poster_profile_id: string;
  poster_name: string;
  poster_player_type: PlayerType;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  event_date: string | null;
};

export type AdminRequestRow = {
  request_id: string;
  requester_profile_id: string;
  requester_name: string;
  requester_player_type: PlayerType;
  recipient_profile_id: string;
  recipient_name: string;
  recipient_player_type: PlayerType;
  status: "pending" | "accepted" | "declined";
  message: string | null;
  created_at: string;
};

export type AdminLogEntry = {
  id: string;
  admin_email: string | null;
  action_type: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getAdminStats(
  supabase: SupabaseClient,
): Promise<AdminStats> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    usersRes,
    profilesRes,
    postsRes,
    requestsRes,
    pendingRes,
    threadsRes,
    messagesRes,
    signupsRes,
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("player_type, is_published, is_suspended"),
    supabase
      .from("marketplace_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("connection_requests")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("connection_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("message_threads").select("id", { count: "exact", head: true }),
    supabase.from("dm_messages").select("id", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo),
  ]);

  const byPlayerType: Record<PlayerType | "none", number> = {
    band: 0,
    venue: 0,
    talent_buyer: 0,
    record_label: 0,
    festival: 0,
    none: 0,
  };
  let published = 0;
  let suspended = 0;
  let total = 0;

  for (const row of profilesRes.data ?? []) {
    total++;
    const t = (row.player_type as PlayerType) ?? "none";
    byPlayerType[t] = (byPlayerType[t] ?? 0) + 1;
    if (row.is_published) published++;
    if (row.is_suspended) suspended++;
  }

  return {
    totalUsers: usersRes.count ?? 0,
    byPlayerType,
    publishedProfiles: published,
    unpublishedProfiles: total - published,
    suspendedProfiles: suspended,
    activeMarketplacePosts: postsRes.count ?? 0,
    totalConnectionRequests: requestsRes.count ?? 0,
    pendingRequests: pendingRes.count ?? 0,
    totalThreads: threadsRes.count ?? 0,
    totalMessages: messagesRes.count ?? 0,
    signupsThisWeek: signupsRes.count ?? 0,
  };
}

// ─── Users list ─────────────────────────────────────────────────────────────

export async function getAdminUsers(
  supabase: SupabaseClient,
  filters: {
    playerType?: PlayerType | "all";
    suspendedOnly?: boolean;
    unpublishedOnly?: boolean;
    query?: string;
  } = {},
): Promise<AdminUserRow[]> {
  // Get all users joined to their profile (if any)
  const { data: users } = await supabase
    .from("users")
    .select("id, email, full_name, created_at")
    .order("created_at", { ascending: false });

  if (!users) return [];

  const userIds = users.map((u) => u.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, user_id, player_type, is_published, is_suspended, suspended_at, suspended_reason",
    )
    .in("user_id", userIds);

  const profileByUser = new Map<string, NonNullable<typeof profiles>[number]>();
  for (const p of profiles ?? []) profileByUser.set(p.user_id, p);

  const profileIds = (profiles ?? []).map((p) => p.id);
  const nameMap = await fetchProfileDisplayNames(supabase, profileIds);

  let rows: AdminUserRow[] = users.map((u) => {
    const prof = profileByUser.get(u.id);
    return {
      user_id: u.id,
      email: u.email,
      full_name: u.full_name,
      created_at: u.created_at,
      profile_id: prof?.id ?? null,
      player_type: (prof?.player_type as PlayerType) ?? null,
      display_name:
        (prof ? nameMap.get(prof.id) : null) ?? u.full_name ?? "(no profile)",
      is_published: prof?.is_published ?? false,
      is_suspended: prof?.is_suspended ?? false,
      suspended_at: prof?.suspended_at ?? null,
      suspended_reason: prof?.suspended_reason ?? null,
    };
  });

  if (filters.playerType && filters.playerType !== "all") {
    rows = rows.filter((r) => r.player_type === filters.playerType);
  }
  if (filters.suspendedOnly) {
    rows = rows.filter((r) => r.is_suspended);
  }
  if (filters.unpublishedOnly) {
    rows = rows.filter((r) => !r.is_published);
  }
  if (filters.query) {
    const q = filters.query.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.display_name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q),
    );
  }

  return rows;
}

// ─── User detail ────────────────────────────────────────────────────────────

export async function getAdminUserDetail(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminUserDetail | null> {
  const { data: user } = await supabase
    .from("users")
    .select("id, email, full_name, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const nameMap = profile
    ? await fetchProfileDisplayNames(supabase, [profile.id])
    : new Map<string, string>();

  let activePostCount = 0;
  let incomingRequests = 0;
  let outgoingRequests = 0;
  let threadCount = 0;

  if (profile) {
    const [{ count: posts }, { count: incoming }, { count: outgoing }] =
      await Promise.all([
        supabase
          .from("marketplace_posts")
          .select("id", { count: "exact", head: true })
          .eq("poster_profile_id", profile.id)
          .eq("is_active", true),
        supabase
          .from("connection_requests")
          .select("id", { count: "exact", head: true })
          .eq("recipient_profile_id", profile.id),
        supabase
          .from("connection_requests")
          .select("id", { count: "exact", head: true })
          .eq("requester_profile_id", profile.id),
      ]);
    activePostCount = posts ?? 0;
    incomingRequests = incoming ?? 0;
    outgoingRequests = outgoing ?? 0;

    const { count: threads } = await supabase
      .from("message_threads")
      .select("id", { count: "exact", head: true })
      .or(`profile_a_id.eq.${profile.id},profile_b_id.eq.${profile.id}`);
    threadCount = threads ?? 0;
  }

  return {
    user_id: user.id,
    email: user.email,
    full_name: user.full_name,
    created_at: user.created_at,
    profile_id: profile?.id ?? null,
    player_type: (profile?.player_type as PlayerType) ?? null,
    display_name:
      (profile ? nameMap.get(profile.id) : null) ?? user.full_name ?? "(no profile)",
    is_published: profile?.is_published ?? false,
    is_suspended: profile?.is_suspended ?? false,
    suspended_at: profile?.suspended_at ?? null,
    suspended_reason: profile?.suspended_reason ?? null,
    bio: profile?.bio ?? null,
    phone_number: profile?.phone_number ?? null,
    website_url: profile?.website_url ?? null,
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    zip_code: profile?.zip_code ?? null,
    street_address: profile?.street_address ?? null,
    instagram_handle: profile?.instagram_handle ?? null,
    instagram_followers: profile?.instagram_followers ?? null,
    active_post_count: activePostCount,
    incoming_request_count: incomingRequests,
    outgoing_request_count: outgoingRequests,
    thread_count: threadCount,
  };
}

// ─── Posts list ─────────────────────────────────────────────────────────────

export async function getAdminPosts(
  supabase: SupabaseClient,
  filters: { activeOnly?: boolean; query?: string } = {},
): Promise<AdminPostRow[]> {
  let query = supabase
    .from("marketplace_posts")
    .select(
      "id, title, post_type, poster_profile_id, is_active, created_at, expires_at, event_date",
    )
    .order("created_at", { ascending: false });

  if (filters.activeOnly) query = query.eq("is_active", true);

  const { data: posts } = await query;
  if (!posts) return [];

  const posterIds = Array.from(new Set(posts.map((p) => p.poster_profile_id)));
  const [nameMap, typeMap] = await Promise.all([
    fetchProfileDisplayNames(supabase, posterIds),
    fetchProfilePlayerTypes(supabase, posterIds),
  ]);

  let rows: AdminPostRow[] = posts.map((p) => ({
    post_id: p.id,
    title: p.title,
    post_type: p.post_type as "event" | "opportunity",
    poster_profile_id: p.poster_profile_id,
    poster_name: nameMap.get(p.poster_profile_id) ?? "(unknown)",
    poster_player_type: typeMap.get(p.poster_profile_id) ?? "venue",
    is_active: p.is_active,
    created_at: p.created_at,
    expires_at: p.expires_at,
    event_date: p.event_date,
  }));

  if (filters.query) {
    const q = filters.query.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.poster_name.toLowerCase().includes(q),
    );
  }
  return rows;
}

// ─── Connection requests ────────────────────────────────────────────────────

export async function getAdminRequests(
  supabase: SupabaseClient,
  filters: { status?: "pending" | "accepted" | "declined" | "all" } = {},
): Promise<AdminRequestRow[]> {
  let q = supabase
    .from("connection_requests")
    .select(
      "id, requester_profile_id, recipient_profile_id, status, message, created_at",
    )
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    q = q.eq("status", filters.status);
  }

  const { data: requests } = await q;
  if (!requests) return [];

  const ids = Array.from(
    new Set(
      requests.flatMap((r) => [r.requester_profile_id, r.recipient_profile_id]),
    ),
  );
  const [nameMap, typeMap] = await Promise.all([
    fetchProfileDisplayNames(supabase, ids),
    fetchProfilePlayerTypes(supabase, ids),
  ]);

  return requests.map((r) => ({
    request_id: r.id,
    requester_profile_id: r.requester_profile_id,
    requester_name: nameMap.get(r.requester_profile_id) ?? "(unknown)",
    requester_player_type: typeMap.get(r.requester_profile_id) ?? "band",
    recipient_profile_id: r.recipient_profile_id,
    recipient_name: nameMap.get(r.recipient_profile_id) ?? "(unknown)",
    recipient_player_type: typeMap.get(r.recipient_profile_id) ?? "venue",
    status: r.status as "pending" | "accepted" | "declined",
    message: r.message,
    created_at: r.created_at,
  }));
}

// ─── Admin log ──────────────────────────────────────────────────────────────

export async function getAdminLog(
  supabase: SupabaseClient,
  limit = 100,
): Promise<AdminLogEntry[]> {
  const { data } = await supabase
    .from("admin_action_log")
    .select(
      "id, admin_email, action_type, target_type, target_id, target_label, details, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AdminLogEntry[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchProfileDisplayNames(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (profileIds.length === 0) return map;

  const queries = await Promise.all([
    supabase
      .from("band_details")
      .select("profile_id, band_name")
      .in("profile_id", profileIds),
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
  ]);
  for (const row of queries[0].data ?? [])
    map.set(row.profile_id, row.band_name ?? "Band");
  for (const row of queries[1].data ?? [])
    map.set(row.profile_id, row.venue_name ?? "Venue");
  for (const row of queries[2].data ?? [])
    map.set(row.profile_id, row.company_name ?? "Talent buyer");
  for (const row of queries[3].data ?? [])
    map.set(row.profile_id, row.label_name ?? "Record label");
  for (const row of queries[4].data ?? [])
    map.set(row.profile_id, row.festival_name ?? "Festival");
  return map;
}

async function fetchProfilePlayerTypes(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, PlayerType>> {
  const map = new Map<string, PlayerType>();
  if (profileIds.length === 0) return map;
  const { data } = await supabase
    .from("profiles")
    .select("id, player_type")
    .in("id", profileIds);
  for (const r of data ?? []) map.set(r.id, r.player_type as PlayerType);
  return map;
}
