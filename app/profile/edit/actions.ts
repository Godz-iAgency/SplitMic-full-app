"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { tableForPlayerType } from "@/lib/supabase/profile";
import { normalizeWebsiteUrl } from "@/lib/url";
import { resolveVideoEmbed } from "@/lib/media/videoEmbed";
import { buildSocialLinks } from "@/lib/profile/socialLinks";
import { buildDetailRow } from "@/lib/profile/detailRow";
import { validateProfilePayload } from "@/lib/profile/validation";
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

  const validationError = validateProfilePayload(payload);
  if (validationError) return { error: validationError };

  // Verify ownership
  const { data: ownedProfile } = await supabase
    .from("profiles")
    .select("id, player_type")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!ownedProfile) return { error: "Profile not found." };
  if (ownedProfile.player_type !== payload.kind)
    return { error: "Profile type does not match this account." };

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
  const links = buildSocialLinks(profileId, payload.common);
  const { error: deleteLinksError } = await supabase
    .from("profile_links").delete().eq("profile_id", profileId);
  if (deleteLinksError) return { error: deleteLinksError.message };
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

/**
 * Saves (or clears) the profile's intro video link.
 *
 * Re-validates the URL server-side rather than trusting the client's check —
 * this value ends up as an iframe `src` on a public page, so the provider
 * allowlist in resolveVideoEmbed is a security boundary, not just UX. Storing
 * the raw pasted link (not the derived embed URL) keeps the user's own link
 * intact for display and lets the resolver change without a data migration.
 */
export async function saveIntroVideoUrl(
  profileId: string,
  rawUrl: string,
): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const trimmed = rawUrl.trim();
  if (trimmed) {
    const resolved = resolveVideoEmbed(trimmed);
    if (!resolved.ok) return { error: resolved.reason };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      intro_video_url: trimmed || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    // Ownership is enforced in the query itself: a profile the caller doesn't
    // own matches zero rows rather than updating someone else's.
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/profile/${profileId}`);
  revalidatePath("/profile/edit");
  return {};
}
