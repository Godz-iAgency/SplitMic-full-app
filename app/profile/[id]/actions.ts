"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function publishProfile(
  profileId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated." };

  // Verify ownership before publishing
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, is_suspended")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) return { ok: false, error: "Profile not found." };
  if (profile.user_id !== user.id) return { ok: false, error: "Not your profile." };
  if (profile.is_suspended) return { ok: false, error: "Suspended profiles cannot be published." };

  const { data: published, error } = await supabase
    .from("profiles")
    .update({ is_published: true })
    .eq("id", profileId)
    .eq("user_id", user.id)
    .eq("is_suspended", false)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!published) return { ok: false, error: "Profile could not be published." };

  revalidatePath(`/profile/${profileId}`);
  return { ok: true };
}

export async function unpublishProfile(
  profileId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated." };

  // Verify ownership before unpublishing
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) return { ok: false, error: "Profile not found." };
  if (profile.user_id !== user.id) return { ok: false, error: "Not your profile." };

  const { error } = await supabase
    .from("profiles")
    .update({ is_published: false })
    .eq("id", profileId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/profile/${profileId}`);
  return { ok: true };
}
