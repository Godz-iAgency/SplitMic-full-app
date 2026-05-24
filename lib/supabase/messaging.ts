import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerType } from "@/lib/types";

const BUCKET = "profile-media";

// Industry player types can DM bands directly (no Connect request needed).
const INDUSTRY_TYPES: PlayerType[] = [
  "venue",
  "talent_buyer",
  "record_label",
  "festival",
];

export function isIndustryPlayerType(t: PlayerType): boolean {
  return INDUSTRY_TYPES.includes(t);
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type ThreadSummary = {
  thread_id: string;
  other_profile_id: string;
  other_name: string;
  other_player_type: PlayerType;
  other_avatar_url: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
};

export type IncomingRequest = {
  request_id: string;
  requester_profile_id: string;
  requester_name: string;
  requester_player_type: PlayerType;
  requester_avatar_url: string | null;
  message: string | null;
  request_type: "connection" | "post_response";
  related_post_id: string | null;
  related_post_title: string | null;
  created_at: string;
};

export type ThreadMessage = {
  id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type ThreadDetail = {
  thread_id: string;
  other_profile_id: string;
  other_name: string;
  other_player_type: PlayerType;
  other_avatar_url: string | null;
  my_profile_id: string;
  messages: ThreadMessage[];
};

// ─── Inbox queries ────────────────────────────────────────────────────────

/** Pending requests received by the current user. */
export async function getIncomingRequests(
  supabase: SupabaseClient,
  myUserId: string,
): Promise<IncomingRequest[]> {
  const { data: requests } = await supabase
    .from("connection_requests")
    .select(
      "id, requester_profile_id, message, request_type, related_post_id, created_at",
    )
    .eq("recipient_user_id", myUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!requests || requests.length === 0) return [];

  const requesterIds = Array.from(
    new Set(requests.map((r) => r.requester_profile_id)),
  );
  const postIds = Array.from(
    new Set(
      requests
        .map((r) => r.related_post_id)
        .filter((id): id is string => !!id),
    ),
  );

  const [nameMap, avatarMap, typeMap, postTitleMap] = await Promise.all([
    fetchProfileNames(supabase, requesterIds),
    fetchAvatars(supabase, requesterIds),
    fetchPlayerTypes(supabase, requesterIds),
    postIds.length > 0
      ? fetchPostTitles(supabase, postIds)
      : Promise.resolve(new Map<string, string>()),
  ]);

  return requests.map((r) => ({
    request_id: r.id,
    requester_profile_id: r.requester_profile_id,
    requester_name: nameMap.get(r.requester_profile_id) ?? "Austin player",
    requester_player_type:
      typeMap.get(r.requester_profile_id) ?? "band",
    requester_avatar_url: avatarMap.get(r.requester_profile_id) ?? null,
    message: r.message,
    request_type: r.request_type as "connection" | "post_response",
    related_post_id: r.related_post_id,
    related_post_title: r.related_post_id
      ? postTitleMap.get(r.related_post_id) ?? null
      : null,
    created_at: r.created_at,
  }));
}

/** Threads the user is part of, with last message + unread count. */
export async function getThreadSummaries(
  supabase: SupabaseClient,
  myUserId: string,
  myProfileId: string,
): Promise<ThreadSummary[]> {
  const { data: threads } = await supabase
    .from("message_threads")
    .select(
      "id, profile_a_id, profile_b_id, user_a_id, user_b_id, last_message_at",
    )
    .or(`user_a_id.eq.${myUserId},user_b_id.eq.${myUserId}`)
    .order("last_message_at", { ascending: false });

  if (!threads || threads.length === 0) return [];

  // Map each thread → the OTHER party
  const otherIds = threads.map((t) =>
    t.user_a_id === myUserId ? t.profile_b_id : t.profile_a_id,
  );
  const threadIds = threads.map((t) => t.id);

  const [nameMap, avatarMap, typeMap, lastMsgMap, unreadMap] =
    await Promise.all([
      fetchProfileNames(supabase, otherIds),
      fetchAvatars(supabase, otherIds),
      fetchPlayerTypes(supabase, otherIds),
      fetchLastMessages(supabase, threadIds),
      fetchUnreadCounts(supabase, threadIds, myProfileId),
    ]);

  return threads.map((t) => {
    const otherProfileId =
      t.user_a_id === myUserId ? t.profile_b_id : t.profile_a_id;
    return {
      thread_id: t.id,
      other_profile_id: otherProfileId,
      other_name: nameMap.get(otherProfileId) ?? "Austin player",
      other_player_type: typeMap.get(otherProfileId) ?? "band",
      other_avatar_url: avatarMap.get(otherProfileId) ?? null,
      last_message_at: t.last_message_at,
      last_message_preview: lastMsgMap.get(t.id) ?? null,
      unread_count: unreadMap.get(t.id) ?? 0,
    };
  });
}

/** Total unread count for the header bell. */
export async function getTotalUnreadCount(
  supabase: SupabaseClient,
  myUserId: string,
  myProfileId: string,
): Promise<number> {
  // Pending requests received
  const { count: requestCount } = await supabase
    .from("connection_requests")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", myUserId)
    .eq("status", "pending");

  // Unread messages: messages in my threads where I'm not the sender and not read
  const { data: threads } = await supabase
    .from("message_threads")
    .select("id")
    .or(`user_a_id.eq.${myUserId},user_b_id.eq.${myUserId}`);

  let unread = 0;
  if (threads && threads.length > 0) {
    const { count } = await supabase
      .from("dm_messages")
      .select("id", { count: "exact", head: true })
      .in(
        "thread_id",
        threads.map((t) => t.id),
      )
      .neq("sender_profile_id", myProfileId)
      .is("read_at", null);
    unread = count ?? 0;
  }

  return (requestCount ?? 0) + unread;
}

/** Full thread: messages + other party info. */
export async function getThreadDetail(
  supabase: SupabaseClient,
  threadId: string,
  myUserId: string,
  myProfileId: string,
): Promise<ThreadDetail | null> {
  const { data: thread } = await supabase
    .from("message_threads")
    .select(
      "id, profile_a_id, profile_b_id, user_a_id, user_b_id",
    )
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) return null;
  // RLS already gates this, but double-check
  if (thread.user_a_id !== myUserId && thread.user_b_id !== myUserId)
    return null;

  const otherProfileId =
    thread.user_a_id === myUserId ? thread.profile_b_id : thread.profile_a_id;

  const [{ data: messageRows }, nameMap, avatarMap, typeMap] =
    await Promise.all([
      supabase
        .from("dm_messages")
        .select("id, sender_profile_id, body, created_at, read_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true }),
      fetchProfileNames(supabase, [otherProfileId]),
      fetchAvatars(supabase, [otherProfileId]),
      fetchPlayerTypes(supabase, [otherProfileId]),
    ]);

  return {
    thread_id: thread.id,
    other_profile_id: otherProfileId,
    other_name: nameMap.get(otherProfileId) ?? "Austin player",
    other_player_type: typeMap.get(otherProfileId) ?? "band",
    other_avatar_url: avatarMap.get(otherProfileId) ?? null,
    my_profile_id: myProfileId,
    messages: (messageRows ?? []) as ThreadMessage[],
  };
}

/**
 * Find an existing connection state between me and another profile.
 * Used by the Connect button on profile pages.
 */
export async function getConnectionState(
  supabase: SupabaseClient,
  myProfileId: string,
  myUserId: string,
  otherProfileId: string,
): Promise<{
  state: "none" | "pending_outbound" | "pending_inbound" | "connected";
  threadId: string | null;
}> {
  // Check existing thread
  const smaller =
    myProfileId < otherProfileId ? myProfileId : otherProfileId;
  const larger =
    myProfileId < otherProfileId ? otherProfileId : myProfileId;

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("profile_a_id", smaller)
    .eq("profile_b_id", larger)
    .maybeSingle();

  if (thread) return { state: "connected", threadId: thread.id };

  // Check pending request
  const { data: requests } = await supabase
    .from("connection_requests")
    .select("requester_user_id, status")
    .eq("status", "pending")
    .or(
      `and(requester_profile_id.eq.${myProfileId},recipient_profile_id.eq.${otherProfileId}),and(requester_profile_id.eq.${otherProfileId},recipient_profile_id.eq.${myProfileId})`,
    )
    .limit(1);

  if (requests && requests.length > 0) {
    const isOutbound = requests[0].requester_user_id === myUserId;
    return {
      state: isOutbound ? "pending_outbound" : "pending_inbound",
      threadId: null,
    };
  }

  return { state: "none", threadId: null };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchProfileNames(
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

async function fetchAvatars(
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

async function fetchPlayerTypes(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, PlayerType>> {
  const map = new Map<string, PlayerType>();
  if (profileIds.length === 0) return map;

  const { data } = await supabase
    .from("profiles")
    .select("id, player_type")
    .in("id", profileIds);

  for (const r of data ?? []) {
    map.set(r.id, r.player_type as PlayerType);
  }
  return map;
}

async function fetchPostTitles(
  supabase: SupabaseClient,
  postIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (postIds.length === 0) return map;

  const { data } = await supabase
    .from("marketplace_posts")
    .select("id, title")
    .in("id", postIds);

  for (const p of data ?? []) {
    map.set(p.id, p.title);
  }
  return map;
}

async function fetchLastMessages(
  supabase: SupabaseClient,
  threadIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (threadIds.length === 0) return map;

  // Fetch newest message per thread. We pull a reasonable batch and pick first per thread.
  const { data } = await supabase
    .from("dm_messages")
    .select("thread_id, body, created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  for (const m of data ?? []) {
    if (!map.has(m.thread_id)) {
      map.set(m.thread_id, m.body);
    }
  }
  return map;
}

async function fetchUnreadCounts(
  supabase: SupabaseClient,
  threadIds: string[],
  myProfileId: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (threadIds.length === 0) return map;

  const { data } = await supabase
    .from("dm_messages")
    .select("thread_id")
    .in("thread_id", threadIds)
    .neq("sender_profile_id", myProfileId)
    .is("read_at", null);

  for (const m of data ?? []) {
    map.set(m.thread_id, (map.get(m.thread_id) ?? 0) + 1);
  }
  return map;
}
