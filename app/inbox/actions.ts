"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isIndustryPlayerType } from "@/lib/supabase/messaging";
import type { PlayerType } from "@/lib/types";

// ─── Respond to a connection request ─────────────────────────────────────

export async function respondToConnectionRequest(
  requestId: string,
  decision: "accepted" | "declined",
): Promise<{ error?: string; threadId?: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify recipient + get request details
  const { data: request } = await supabase
    .from("connection_requests")
    .select(
      "id, recipient_user_id, requester_profile_id, recipient_profile_id, status",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { error: "Request not found." };
  if (request.recipient_user_id !== user.id)
    return { error: "Not authorized." };
  if (request.status !== "pending")
    return { error: "This request was already responded to." };

  const { error } = await supabase
    .from("connection_requests")
    .update({ status: decision })
    .eq("id", requestId);

  if (error) return { error: error.message };

  // If accepted, look up the thread (created by DB trigger)
  let threadId: string | undefined;
  if (decision === "accepted") {
    const smaller =
      request.requester_profile_id < request.recipient_profile_id
        ? request.requester_profile_id
        : request.recipient_profile_id;
    const larger =
      request.requester_profile_id < request.recipient_profile_id
        ? request.recipient_profile_id
        : request.requester_profile_id;

    const { data: thread } = await supabase
      .from("message_threads")
      .select("id")
      .eq("profile_a_id", smaller)
      .eq("profile_b_id", larger)
      .maybeSingle();

    threadId = thread?.id;
  }

  revalidatePath("/inbox");
  return { threadId };
}

// ─── Send a message in an existing thread ────────────────────────────────

export async function sendMessage(
  threadId: string,
  body: string,
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const trimmed = body.trim();
  if (!trimmed) return { error: "Message is empty." };
  if (trimmed.length > 4000)
    return { error: "Message is too long (max 4000)." };

  // Get sender profile id
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return { error: "Profile not found." };

  // Verify thread membership (RLS will also block)
  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, user_a_id, user_b_id")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return { error: "Thread not found." };
  if (thread.user_a_id !== user.id && thread.user_b_id !== user.id)
    return { error: "Not authorized." };

  const { error } = await supabase.from("dm_messages").insert({
    thread_id: threadId,
    sender_profile_id: profile.id,
    sender_user_id: user.id,
    body: trimmed,
  });

  if (error) return { error: error.message };

  revalidatePath(`/inbox/${threadId}`);
  revalidatePath("/inbox");
  return {};
}

// ─── Mark all messages in a thread as read (when opening) ────────────────

export async function markThreadRead(threadId: string): Promise<void> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return;

  await supabase
    .from("dm_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .neq("sender_profile_id", profile.id)
    .is("read_at", null);

  revalidatePath("/inbox");
}

// ─── Initiate a connection (Connect button on profile pages) ─────────────
// Rules:
//   - Industry players (venue/talent_buyer/record_label/festival) initiating
//     to ANY profile → creates a thread immediately (direct DM)
//   - Bands initiating to ANY profile → creates a pending connection_request
//   - Band-to-band → also goes via connection_request (mutual)
//   - Industry-to-industry → direct DM

export async function initiateConnection(
  otherProfileId: string,
  initialMessage: string,
): Promise<{ error?: string; threadId?: string; mode?: "thread" | "request" }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id, player_type, is_published")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!myProfile) return { error: "Complete your profile first." };
  if (!myProfile.is_published)
    return { error: "Publish your profile before connecting." };
  if (myProfile.id === otherProfileId)
    return { error: "You can't connect with yourself." };

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("id, user_id, is_published")
    .eq("id", otherProfileId)
    .maybeSingle();

  if (!otherProfile) return { error: "Profile not found." };
  if (!otherProfile.is_published)
    return { error: "That profile isn't published yet." };

  const myType = myProfile.player_type as PlayerType;
  const trimmed = initialMessage.trim();

  // INDUSTRY → ANYONE = direct thread
  if (isIndustryPlayerType(myType)) {
    const smaller =
      myProfile.id < otherProfile.id ? myProfile.id : otherProfile.id;
    const larger =
      myProfile.id < otherProfile.id ? otherProfile.id : myProfile.id;
    const smallerUser =
      myProfile.id < otherProfile.id ? user.id : otherProfile.user_id;
    const largerUser =
      myProfile.id < otherProfile.id ? otherProfile.user_id : user.id;

    // Create thread if not exists
    const { error: threadError } = await supabase
      .from("message_threads")
      .insert({
        profile_a_id: smaller,
        profile_b_id: larger,
        user_a_id: smallerUser,
        user_b_id: largerUser,
      });

    // Ignore unique violation (thread already exists)
    if (threadError && threadError.code !== "23505") {
      return { error: threadError.message };
    }

    const { data: thread } = await supabase
      .from("message_threads")
      .select("id")
      .eq("profile_a_id", smaller)
      .eq("profile_b_id", larger)
      .maybeSingle();

    if (!thread) return { error: "Thread could not be created." };

    if (trimmed) {
      const { error: msgError } = await supabase.from("dm_messages").insert({
        thread_id: thread.id,
        sender_profile_id: myProfile.id,
        sender_user_id: user.id,
        body: trimmed,
      });
      if (msgError) return { error: msgError.message };
    }

    revalidatePath("/inbox");
    return { threadId: thread.id, mode: "thread" };
  }

  // BAND → ANYONE = connection request
  const { error: insertError } = await supabase
    .from("connection_requests")
    .insert({
      requester_profile_id: myProfile.id,
      requester_user_id: user.id,
      recipient_profile_id: otherProfile.id,
      recipient_user_id: otherProfile.user_id,
      request_type: "connection",
      message: trimmed || null,
      status: "pending",
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "You've already sent a request to this profile." };
    }
    return { error: insertError.message };
  }

  revalidatePath("/inbox");
  return { mode: "request" };
}
