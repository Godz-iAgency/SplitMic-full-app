"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { tableForPlayerType } from "@/lib/supabase/profile";
import { normalizeWebsiteUrl } from "@/lib/url";
import type { ProfilePayload } from "@/components/onboarding/ProfileStep";

export async function saveProfileInfo(
  profileId: string,
  payload: ProfilePayload,
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify ownership
  const { data: ownedProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!ownedProfile) return { error: "Profile not found." };

  // 1. Update profiles row
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      bio: payload.common.bio,
      phone_number: payload.common.phone_number || null,
      website_url: normalizeWebsiteUrl(payload.common.website_url),
      instagram_handle: payload.common.instagram_handle || null,
      instagram_followers:
        payload.common.instagram_followers === ""
          ? null
          : payload.common.instagram_followers,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .eq("user_id", user.id);

  if (profileError) return { error: profileError.message };

  // 2. Upsert detail table
  const tableName = tableForPlayerType(payload.kind);
  const detailRow = buildDetailRow(profileId, user.id, payload);

  const { error: detailError } = await supabase
    .from(tableName)
    .upsert(detailRow, { onConflict: "profile_id" });

  if (detailError) return { error: detailError.message };

  // 3. Replace profile_links
  const links = buildProfileLinks(profileId, payload);
  await supabase.from("profile_links").delete().eq("profile_id", profileId);
  if (links.length > 0) {
    const { error: linksError } = await supabase
      .from("profile_links")
      .insert(links);
    if (linksError) return { error: linksError.message };
  }

  // 4. Update users.full_name
  const { error: userError } = await supabase
    .from("users")
    .update({
      full_name: payload.common.full_name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (userError) return { error: userError.message };

  revalidatePath(`/profile/${profileId}`);
  revalidatePath("/profile/edit");
  return {};
}

// ─── helpers (mirrors OnboardingFlow logic) ──────────────────────────────────

function buildDetailRow(
  profileId: string,
  userId: string,
  payload: ProfilePayload,
) {
  const base = { profile_id: profileId, user_id: userId };
  const num = (v: number | "") => (v === "" ? null : v);

  switch (payload.kind) {
    case "band":
      return {
        ...base,
        band_name: payload.specific.band_name,
        genres: payload.specific.genres,
        member_count: num(payload.specific.member_count),
        sound_description: payload.specific.sound_description,
        set_length_minutes: num(payload.specific.set_length_minutes),
        booking_email: payload.specific.booking_email || null,
        booking_fee_min: num(payload.specific.booking_fee_min),
        booking_fee_max: num(payload.specific.booking_fee_max),
      };
    case "venue":
      return {
        ...base,
        venue_name: payload.specific.venue_name,
        venue_type: payload.specific.venue_type || null,
        capacity: num(payload.specific.capacity),
        age_restriction: payload.specific.age_restriction || null,
        genres_hosted: payload.specific.genres_hosted,
        shows_per_week: num(payload.specific.shows_per_week),
        booking_contact_name: payload.specific.booking_contact_name,
        booking_contact_email: payload.specific.booking_contact_email,
        pay_structure: payload.specific.pay_structure || null,
        pay_min: num(payload.specific.pay_min),
        pay_max: num(payload.specific.pay_max),
      };
    case "talent_buyer":
      return {
        ...base,
        company_name: payload.specific.company_name,
        company_type: payload.specific.company_type,
        genres_focus: payload.specific.genres_focus,
        typical_booking_fee: payload.specific.typical_booking_fee,
        booking_radius_miles: num(payload.specific.booking_radius_miles),
        contact_email: payload.specific.contact_email,
        artist_budget_min: num(payload.specific.artist_budget_min),
        artist_budget_max: num(payload.specific.artist_budget_max),
        events_per_year: num(payload.specific.events_per_year),
      };
    case "record_label":
      return {
        ...base,
        label_name: payload.specific.label_name,
        label_type: payload.specific.label_type,
        genres_focus: payload.specific.genres_focus,
        artists_signed: num(payload.specific.artists_signed),
        submission_email: payload.specific.submission_email,
        deal_types:
          payload.specific.deal_types.length > 0
            ? payload.specific.deal_types
            : null,
        looking_for: payload.specific.looking_for || null,
      };
    case "festival":
      return {
        ...base,
        festival_name: payload.specific.festival_name,
        festival_type: payload.specific.festival_type || null,
        festival_season: payload.specific.festival_season || null,
        genres_featured: payload.specific.genres_featured,
        expected_attendance: num(payload.specific.expected_attendance),
        total_band_slots: num(payload.specific.total_band_slots),
        application_email: payload.specific.application_email,
        pays_bands:
          payload.specific.pays_bands === ""
            ? null
            : payload.specific.pays_bands === "yes",
        pay_min: num(payload.specific.pay_min),
        pay_max: num(payload.specific.pay_max),
      };
  }
}

function buildProfileLinks(
  profileId: string,
  payload: ProfilePayload,
): Array<{ profile_id: string; platform: string; url: string }> {
  const links: Array<{ profile_id: string; platform: string; url: string }> =
    [];

  const twitter = payload.common.twitter_handle?.trim();
  if (twitter) {
    const handle = twitter.replace(/^@/, "");
    const url = handle.startsWith("http")
      ? handle
      : `https://x.com/${handle}`;
    links.push({ profile_id: profileId, platform: "twitter", url });
  }

  if (payload.kind === "band") {
    const { spotify_artist_url, youtube_channel_url, tiktok_handle, facebook_url } =
      payload.specific;
    if (spotify_artist_url?.trim())
      links.push({ profile_id: profileId, platform: "spotify", url: spotify_artist_url.trim() });
    if (youtube_channel_url?.trim())
      links.push({ profile_id: profileId, platform: "youtube", url: youtube_channel_url.trim() });
    if (tiktok_handle?.trim()) {
      const handle = tiktok_handle.trim().replace(/^@/, "");
      const url = handle.startsWith("http") ? handle : `https://tiktok.com/@${handle}`;
      links.push({ profile_id: profileId, platform: "tiktok", url });
    }
    if (facebook_url?.trim())
      links.push({ profile_id: profileId, platform: "facebook", url: facebook_url.trim() });
  }

  return links;
}
