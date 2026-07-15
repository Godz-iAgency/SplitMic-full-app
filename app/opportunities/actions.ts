"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notifyByEmail } from "@/lib/notifications/email";
import {
  POSTING_PLAYER_TYPES,
  EVENT_POSTING_PLAYER_TYPES,
  OPEN_MIC_POSTING_PLAYER_TYPES,
  MAX_ACTIVE_EVENT_POSTS,
  MAX_ACTIVE_OPPORTUNITY_POSTS,
  MAX_TAGGED_BANDS_PER_EVENT,
  countActivePosts,
  browseMarketplace,
  type BrowseFilters,
  type BrowseResult,
  type PostType,
} from "@/lib/supabase/marketplace";
import type { PlayerType } from "@/lib/types";

// Event and open-mic posts are both anchored to a specific date.
const DATE_BASED_TYPES: PostType[] = ["event", "open_mic"];

// ─── Browse pagination ───────────────────────────────────────────────────────

export async function loadMoreMarketplace(
  filters: BrowseFilters,
  offset: number,
): Promise<BrowseResult> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { cards: [], hasMore: false };

  return browseMarketplace(supabase, { ...filters, offset });
}

// ─── Create post ────────────────────────────────────────────────────────────

export type CreatePostPayload = {
  post_type: PostType;
  title: string;
  description: string;
  // Event fields
  event_date?: string; // YYYY-MM-DD
  event_end_date?: string; // YYYY-MM-DD — festivals only, multi-day events
  event_location?: string;
  // Opportunity fields
  open_until?: string; // YYYY-MM-DD
  // Common
  genres: string[];
  pay_info: string;
  player_types_wanted: string[];
  // Event tagging
  tagged_band_profile_ids?: string[];
};

export async function createMarketplacePost(
  payload: CreatePostPayload,
): Promise<{ error?: string; postId?: string }> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Look up the user's published profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, player_type, is_published")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return { error: "Complete your profile first." };
  if (!profile.is_published)
    return { error: "Publish your profile before posting." };

  const playerType = profile.player_type as PlayerType;

  // Bands cannot post.
  if (!POSTING_PLAYER_TYPES.includes(playerType)) {
    return {
      error:
        "Bands cannot post directly. Reach out by sending a Connect request.",
    };
  }

  // Only venues + festivals can create event posts.
  if (
    payload.post_type === "event" &&
    !EVENT_POSTING_PLAYER_TYPES.includes(playerType)
  ) {
    return { error: "Only venues and festivals can post events." };
  }

  // Only venues run open mics.
  if (
    payload.post_type === "open_mic" &&
    !OPEN_MIC_POSTING_PLAYER_TYPES.includes(playerType)
  ) {
    return { error: "Only venues can post open mics." };
  }

  // Validate basics
  const title = payload.title.trim();
  if (!title) return { error: "Title is required." };
  if (title.length > 120) return { error: "Title is too long (max 120)." };

  if (DATE_BASED_TYPES.includes(payload.post_type)) {
    if (!payload.event_date)
      return { error: "A date is required for this post." };
    // Date must be today or in the future
    if (payload.event_date < new Date().toISOString().slice(0, 10))
      return { error: "The date must be today or in the future." };
    // End date (festivals): must be on or after start date. Only festivals can set this.
    if (payload.event_end_date) {
      if (playerType !== "festival") {
        return { error: "Only festivals can post multi-day events." };
      }
      if (payload.event_end_date < payload.event_date) {
        return { error: "End date must be on or after the start date." };
      }
    }
  }
  if (payload.post_type === "opportunity") {
    if (!payload.open_until)
      return { error: "An 'Open until' date is required." };
    if (payload.open_until < new Date().toISOString().slice(0, 10))
      return { error: "'Open until' must be today or in the future." };
  }

  // Enforce active-post limits. Open mics share the event limit (counted
  // separately from events, since countActivePosts matches an exact post_type).
  const activeCount = await countActivePosts(
    supabase,
    profile.id,
    payload.post_type,
  );
  const limit =
    payload.post_type === "opportunity"
      ? MAX_ACTIVE_OPPORTUNITY_POSTS
      : MAX_ACTIVE_EVENT_POSTS;

  if (activeCount >= limit) {
    const noun =
      payload.post_type === "opportunity"
        ? "opportunity"
        : payload.post_type === "open_mic"
          ? "open mic"
          : "event";
    return {
      error: `You've reached your limit of ${limit} active ${noun} posts.`,
    };
  }

  // Insert the post — expires_at is computed by trigger; we also pass it for
  // schemas where the trigger isn't yet installed.
  // For multi-day events (festivals), expiry is based on the END date so the
  // post stays live until 7 days AFTER the festival ends.
  const eventExpiryAnchor =
    payload.event_end_date ?? payload.event_date;
  const expiresAt = DATE_BASED_TYPES.includes(payload.post_type)
    ? addDays(eventExpiryAnchor!, 7)
    : addDays(payload.open_until!, 7);

  const { data: inserted, error: insertError } = await supabase
    .from("marketplace_posts")
    .insert({
      poster_profile_id: profile.id,
      poster_user_id: user.id,
      post_type: payload.post_type,
      title,
      description: payload.description.trim() || null,
      event_date: DATE_BASED_TYPES.includes(payload.post_type)
        ? payload.event_date
        : null,
      event_end_date:
        payload.post_type === "event" ? payload.event_end_date ?? null : null,
      event_location: DATE_BASED_TYPES.includes(payload.post_type)
        ? payload.event_location?.trim() || null
        : null,
      open_until:
        payload.post_type === "opportunity" ? payload.open_until : null,
      genres: payload.genres,
      pay_info: payload.pay_info.trim() || null,
      player_types_wanted: payload.player_types_wanted,
      expires_at: expiresAt,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      error: insertError?.message ?? "Could not create post.",
    };
  }

  // Insert band tags (event posts only)
  if (payload.post_type === "event" && payload.tagged_band_profile_ids?.length) {
    const tagIds = payload.tagged_band_profile_ids.slice(
      0,
      MAX_TAGGED_BANDS_PER_EVENT,
    );
    const tagRows = tagIds.map((bandProfileId) => ({
      marketplace_post_id: inserted.id,
      band_profile_id: bandProfileId,
      tagged_by_user_id: user.id,
      status: "pending" as const,
    }));
    // Best-effort — don't fail post creation if tag insert hits a unique
    // constraint or RLS. The poster can re-tag from the detail page later.
    await supabase.from("event_band_tags").insert(tagRows);
  }

  revalidatePath("/opportunities");
  return { postId: inserted.id };
}

// ─── Update post ────────────────────────────────────────────────────────────

export type UpdatePostPayload = {
  postId: string;
  title: string;
  description: string;
  // Event fields
  event_date?: string;
  event_end_date?: string;
  event_location?: string;
  // Opportunity fields
  open_until?: string;
  // Common
  genres: string[];
  pay_info: string;
  player_types_wanted: string[];
};

export async function updateMarketplacePost(
  payload: UpdatePostPayload,
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Load the existing post — we need post_type and to verify ownership.
  const { data: existing } = await supabase
    .from("marketplace_posts")
    .select("id, poster_user_id, post_type")
    .eq("id", payload.postId)
    .maybeSingle();

  if (!existing) return { error: "Post not found." };
  if (existing.poster_user_id !== user.id) {
    return { error: "You can only edit your own posts." };
  }

  const postType = existing.post_type as PostType;

  // Look up the user's profile (for the festival check on multi-day events).
  const { data: profile } = await supabase
    .from("profiles")
    .select("player_type")
    .eq("user_id", user.id)
    .maybeSingle();

  const playerType = (profile?.player_type as PlayerType) ?? "venue";

  // Validate basics
  const title = payload.title.trim();
  if (!title) return { error: "Title is required." };
  if (title.length > 120) return { error: "Title is too long (max 120)." };

  if (postType === "event") {
    if (!payload.event_date)
      return { error: "Event date is required for event posts." };
    if (payload.event_end_date) {
      if (playerType !== "festival") {
        return { error: "Only festivals can post multi-day events." };
      }
      if (payload.event_end_date < payload.event_date) {
        return { error: "End date must be on or after the start date." };
      }
    }
  }
  if (postType === "opportunity") {
    if (!payload.open_until)
      return { error: "An 'Open until' date is required." };
  }

  // Recompute expires_at since dates may have changed.
  const eventExpiryAnchor =
    payload.event_end_date ?? payload.event_date;
  const expiresAt =
    postType === "event"
      ? addDays(eventExpiryAnchor!, 7)
      : addDays(payload.open_until!, 7);

  const { error: updateError } = await supabase
    .from("marketplace_posts")
    .update({
      title,
      description: payload.description.trim() || null,
      event_date: postType === "event" ? payload.event_date : null,
      event_end_date:
        postType === "event" ? payload.event_end_date ?? null : null,
      event_location:
        postType === "event"
          ? payload.event_location?.trim() || null
          : null,
      open_until: postType === "opportunity" ? payload.open_until : null,
      genres: payload.genres,
      pay_info: payload.pay_info.trim() || null,
      player_types_wanted: payload.player_types_wanted,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.postId)
    .eq("poster_user_id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${payload.postId}`);
  return {};
}

// ─── Delete post ────────────────────────────────────────────────────────────

export async function deleteMarketplacePost(
  postId: string,
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("marketplace_posts")
    .delete()
    .eq("id", postId)
    .eq("poster_user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/opportunities");
  redirect("/opportunities");
}

// ─── Tag accept / decline / share (band side) ──────────────────────────────

export async function respondToBandTag(
  tagId: string,
  decision: "accepted" | "declined",
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("event_band_tags")
    .update({
      status: decision,
      responded_at: new Date().toISOString(),
    })
    .eq("id", tagId);

  if (error) return { error: error.message };

  revalidatePath("/opportunities");
  return {};
}

export async function toggleShareTaggedEvent(
  tagId: string,
  share: boolean,
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Can only share if accepted.
  const { data: tag } = await supabase
    .from("event_band_tags")
    .select("id, status")
    .eq("id", tagId)
    .maybeSingle();

  if (!tag) return { error: "Tag not found." };
  if (tag.status !== "accepted")
    return { error: "Accept the tag before sharing." };

  const { error } = await supabase
    .from("event_band_tags")
    .update({ shared_to_feed: share })
    .eq("id", tagId);

  if (error) return { error: error.message };

  revalidatePath("/opportunities");
  return {};
}

// ─── Respond to a post (creates a connection_request) ──────────────────────

export async function respondToPost(
  postId: string,
  message: string,
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Get responder profile
  const { data: responderProfile } = await supabase
    .from("profiles")
    .select("id, is_published")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!responderProfile) return { error: "Complete your profile first." };
  if (!responderProfile.is_published)
    return { error: "Publish your profile before responding." };

  // Get the post + poster identity
  const { data: post } = await supabase
    .from("marketplace_posts")
    .select(
      "id, title, poster_profile_id, poster_user_id, is_active, expires_at",
    )
    .eq("id", postId)
    .maybeSingle();

  if (!post) return { error: "Post not found." };
  if (!post.is_active) return { error: "This post is no longer active." };

  if (post.poster_profile_id === responderProfile.id) {
    return { error: "You can't respond to your own post." };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (post.expires_at < today)
    return { error: "This post has expired." };

  // Insert the request — partial unique index prevents duplicate pending requests.
  const { error: insertError } = await supabase
    .from("connection_requests")
    .insert({
      requester_profile_id: responderProfile.id,
      requester_user_id: user.id,
      recipient_profile_id: post.poster_profile_id,
      recipient_user_id: post.poster_user_id,
      request_type: "post_response",
      related_post_id: post.id,
      message: message.trim() || null,
      status: "pending",
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "You've already responded to this post." };
    }
    return { error: insertError.message };
  }

  await notifyByEmail({
    recipientUserId: post.poster_user_id,
    senderProfileId: responderProfile.id,
    kind: "post_response",
    postTitle: post.title,
  });

  revalidatePath(`/opportunities/${postId}`);
  return {};
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function addDays(yyyyMmDd: string, days: number): string {
  const d = new Date(yyyyMmDd + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Server-side band search (used by the tag picker via debounced action).
export async function searchBandsForTaggingAction(
  query: string,
): Promise<
  Array<{ profile_id: string; band_name: string; avatar_url: string | null }>
> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { searchBandsForTagging } = await import("@/lib/supabase/marketplace");
  return searchBandsForTagging(supabase, query);
}

// ─── Open mic: band signup / withdraw ───────────────────────────────────────

/** A band signs up for an open mic. sort_order is assigned by DB trigger. */
export async function signUpForOpenMic(
  postId: string,
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, player_type, is_published")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return { error: "Complete your profile first." };
  if (profile.player_type !== "band")
    return { error: "Only bands can sign up for an open mic." };
  if (!profile.is_published)
    return { error: "Publish your profile before signing up." };

  // Verify the post exists, is an active open mic, and isn't expired.
  const { data: post } = await supabase
    .from("marketplace_posts")
    .select("id, post_type, is_active, expires_at")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.post_type !== "open_mic")
    return { error: "Open mic not found." };
  if (!post.is_active) return { error: "This open mic is no longer active." };
  if (post.expires_at < new Date().toISOString().slice(0, 10))
    return { error: "This open mic has already passed." };

  const { error: insertError } = await supabase
    .from("open_mic_signups")
    .insert({
      post_id: postId,
      band_profile_id: profile.id,
      band_user_id: user.id,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "You're already signed up for this open mic." };
    }
    return { error: insertError.message };
  }

  revalidatePath(`/opportunities/${postId}`);
  return {};
}

/** A band withdraws its own signup. */
export async function cancelOpenMicSignup(
  postId: string,
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("open_mic_signups")
    .delete()
    .eq("post_id", postId)
    .eq("band_user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/opportunities/${postId}`);
  return {};
}

// ─── Open mic: venue roster management ──────────────────────────────────────

/** Load the caller's post if they own it — shared guard for venue actions. */
async function loadOwnedOpenMicPost(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  signupId: string,
  userId: string,
): Promise<{ postId: string } | { error: string }> {
  const { data: signup } = await supabase
    .from("open_mic_signups")
    .select("post_id")
    .eq("id", signupId)
    .maybeSingle();

  if (!signup) return { error: "Signup not found." };

  const { data: post } = await supabase
    .from("marketplace_posts")
    .select("id, poster_user_id")
    .eq("id", signup.post_id)
    .maybeSingle();

  if (!post || post.poster_user_id !== userId)
    return { error: "You can only manage your own open mic." };

  return { postId: signup.post_id };
}

/** Venue reorders a band up, down, or to the top of the running order. */
export async function reorderOpenMicSignup(
  signupId: string,
  direction: "up" | "down" | "top",
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const owned = await loadOwnedOpenMicPost(supabase, signupId, user.id);
  if ("error" in owned) return { error: owned.error };

  // Load the full roster in order, move the item in-memory, then persist any
  // rows whose position changed. Rosters are small, so a full pass is cheap
  // and avoids fragile swap edge cases.
  const { data: roster } = await supabase
    .from("open_mic_signups")
    .select("id, sort_order")
    .eq("post_id", owned.postId)
    .order("sort_order", { ascending: true });

  if (!roster || roster.length === 0) return {};

  const index = roster.findIndex((r) => r.id === signupId);
  if (index === -1) return { error: "Signup not found." };

  const reordered = [...roster];
  const [moved] = reordered.splice(index, 1);
  if (direction === "top") {
    reordered.unshift(moved);
  } else if (direction === "up") {
    reordered.splice(Math.max(0, index - 1), 0, moved);
  } else {
    reordered.splice(Math.min(reordered.length, index + 1), 0, moved);
  }

  // Persist only the rows whose sort_order actually changed.
  const updates = reordered
    .map((r, i) => ({ id: r.id, oldOrder: r.sort_order, newOrder: i + 1 }))
    .filter((u) => u.oldOrder !== u.newOrder);

  for (const u of updates) {
    const { error } = await supabase
      .from("open_mic_signups")
      .update({ sort_order: u.newOrder })
      .eq("id", u.id);
    if (error) return { error: error.message };
  }

  revalidatePath(`/opportunities/${owned.postId}/roster`);
  return {};
}

/** Venue sets a band's check-in status. */
export async function setOpenMicSignupStatus(
  signupId: string,
  status: "signed_up" | "checked_in" | "no_show",
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const owned = await loadOwnedOpenMicPost(supabase, signupId, user.id);
  if ("error" in owned) return { error: owned.error };

  const { error } = await supabase
    .from("open_mic_signups")
    .update({ status })
    .eq("id", signupId);

  if (error) return { error: error.message };

  revalidatePath(`/opportunities/${owned.postId}/roster`);
  return {};
}

/** Venue removes a band from the open mic. */
export async function removeOpenMicSignup(
  signupId: string,
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const owned = await loadOwnedOpenMicPost(supabase, signupId, user.id);
  if ("error" in owned) return { error: owned.error };

  const { error } = await supabase
    .from("open_mic_signups")
    .delete()
    .eq("id", signupId);

  if (error) return { error: error.message };

  revalidatePath(`/opportunities/${owned.postId}/roster`);
  return {};
}
