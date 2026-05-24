"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  POSTING_PLAYER_TYPES,
  EVENT_POSTING_PLAYER_TYPES,
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

  // Validate basics
  const title = payload.title.trim();
  if (!title) return { error: "Title is required." };
  if (title.length > 120) return { error: "Title is too long (max 120)." };

  if (payload.post_type === "event") {
    if (!payload.event_date)
      return { error: "Event date is required for event posts." };
    // Date must be today or in the future
    if (payload.event_date < new Date().toISOString().slice(0, 10))
      return { error: "Event date must be today or in the future." };
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

  // Enforce active-post limits
  const activeCount = await countActivePosts(
    supabase,
    profile.id,
    payload.post_type,
  );
  const limit =
    payload.post_type === "event"
      ? MAX_ACTIVE_EVENT_POSTS
      : MAX_ACTIVE_OPPORTUNITY_POSTS;

  if (activeCount >= limit) {
    return {
      error:
        payload.post_type === "event"
          ? `You've reached your limit of ${MAX_ACTIVE_EVENT_POSTS} active event posts.`
          : `You've reached your limit of ${MAX_ACTIVE_OPPORTUNITY_POSTS} active opportunity posts.`,
    };
  }

  // Insert the post — expires_at is computed by trigger; we also pass it for
  // schemas where the trigger isn't yet installed.
  // For multi-day events (festivals), expiry is based on the END date so the
  // post stays live until 7 days AFTER the festival ends.
  const eventExpiryAnchor =
    payload.event_end_date ?? payload.event_date;
  const expiresAt =
    payload.post_type === "event"
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
      event_date: payload.post_type === "event" ? payload.event_date : null,
      event_end_date:
        payload.post_type === "event" ? payload.event_end_date ?? null : null,
      event_location:
        payload.post_type === "event"
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
      "id, poster_profile_id, poster_user_id, is_active, expires_at",
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
