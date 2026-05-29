"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAdminEmail } from "@/lib/supabase/admin";

// ─── Admin guard ────────────────────────────────────────────────────────────
// Identity is verified with the cookie-based session client. Only AFTER an
// admin is confirmed do we hand back a service-role client, which bypasses RLS
// so moderation actions (suspend/delete/publish, audit log) actually take effect.

async function requireAdmin() {
  const sessionClient = createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return { error: "Not authorized." as const };
  }
  const supabase = createServiceRoleClient();
  return { supabase, user };
}

async function logAdminAction(
  args: {
    actionType: string;
    targetType: string;
    targetId?: string;
    targetLabel?: string;
    details?: Record<string, unknown>;
  },
) {
  const sessionClient = createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return;
  const supabase = createServiceRoleClient();
  await supabase.from("admin_action_log").insert({
    admin_user_id: user.id,
    admin_email: user.email,
    action_type: args.actionType,
    target_type: args.targetType,
    target_id: args.targetId ?? null,
    target_label: args.targetLabel ?? null,
    details: args.details ?? null,
  });
}

// ─── Suspend / unsuspend user ───────────────────────────────────────────────

export async function adminSuspendUser(
  profileId: string,
  reason: string,
): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;
  const { supabase } = guard;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return { error: "Profile not found." };

  const trimmedReason = reason.trim() || "(no reason given)";

  const { error } = await supabase
    .from("profiles")
    .update({
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      suspended_reason: trimmedReason,
      is_published: false,
    })
    .eq("id", profileId);

  if (error) return { error: error.message };

  await logAdminAction({
    actionType: "suspend_user",
    targetType: "user",
    targetId: profile.user_id,
    targetLabel: profileId,
    details: { reason: trimmedReason, profile_id: profileId },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${profile.user_id}`);
  return {};
}

export async function adminUnsuspendUser(
  profileId: string,
): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;
  const { supabase } = guard;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return { error: "Profile not found." };

  const { error } = await supabase
    .from("profiles")
    .update({
      is_suspended: false,
      suspended_at: null,
      suspended_reason: null,
    })
    .eq("id", profileId);

  if (error) return { error: error.message };

  await logAdminAction({
    actionType: "unsuspend_user",
    targetType: "user",
    targetId: profile.user_id,
    targetLabel: profileId,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${profile.user_id}`);
  return {};
}

// ─── Delete user (cascades through DB) ──────────────────────────────────────

export async function adminDeleteUser(
  userId: string,
): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;
  const { supabase, user: adminUser } = guard;

  if (userId === adminUser.id) {
    return { error: "You can't delete your own admin account." };
  }

  // Get profile for log
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, player_type")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: user } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  // Delete profile first (cascades to detail tables, posts, messages, etc.)
  if (profile) {
    const { error: pErr } = await supabase
      .from("profiles")
      .delete()
      .eq("id", profile.id);
    if (pErr) return { error: `Profile delete failed: ${pErr.message}` };
  }

  // Then delete users row
  const { error: uErr } = await supabase.from("users").delete().eq("id", userId);
  if (uErr) return { error: `User delete failed: ${uErr.message}` };

  await logAdminAction({
    actionType: "delete_user",
    targetType: "user",
    targetId: userId,
    targetLabel: user?.email ?? null,
    details: {
      email: user?.email,
      player_type: profile?.player_type,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

// ─── Delete a marketplace post ──────────────────────────────────────────────

export async function adminDeletePost(
  postId: string,
): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;
  const { supabase } = guard;

  const { data: post } = await supabase
    .from("marketplace_posts")
    .select("id, title, poster_profile_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { error: "Post not found." };

  const { error } = await supabase
    .from("marketplace_posts")
    .delete()
    .eq("id", postId);

  if (error) return { error: error.message };

  await logAdminAction({
    actionType: "delete_post",
    targetType: "post",
    targetId: postId,
    targetLabel: post.title,
    details: { poster_profile_id: post.poster_profile_id },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath("/opportunities");
  return {};
}

// ─── Admin sends an in-app message to a user ────────────────────────────────
// Creates (or reuses) a DM thread between admin's profile and target profile,
// then drops the message in.

export async function adminSendInAppMessage(
  targetProfileId: string,
  body: string,
): Promise<{ error?: string; threadId?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;
  const { supabase, user: adminUser } = guard;

  const trimmed = body.trim();
  if (!trimmed) return { error: "Message is empty." };
  if (trimmed.length > 4000) return { error: "Message too long (4000 max)." };

  // Get admin's own profile
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", adminUser.id)
    .maybeSingle();
  if (!adminProfile)
    return {
      error:
        "You need to complete your own profile before messaging users from admin.",
    };

  // Get target user's user_id
  const { data: target } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("id", targetProfileId)
    .maybeSingle();
  if (!target) return { error: "Target profile not found." };

  if (adminProfile.id === target.id)
    return { error: "Can't message yourself." };

  // Ordered pair
  const smaller =
    adminProfile.id < target.id ? adminProfile.id : target.id;
  const larger =
    adminProfile.id < target.id ? target.id : adminProfile.id;
  const smallerUser =
    adminProfile.id < target.id ? adminUser.id : target.user_id;
  const largerUser =
    adminProfile.id < target.id ? target.user_id : adminUser.id;

  // Create thread (ignore unique-violation if exists)
  const { error: tErr } = await supabase.from("message_threads").insert({
    profile_a_id: smaller,
    profile_b_id: larger,
    user_a_id: smallerUser,
    user_b_id: largerUser,
  });
  if (tErr && tErr.code !== "23505") return { error: tErr.message };

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("profile_a_id", smaller)
    .eq("profile_b_id", larger)
    .maybeSingle();
  if (!thread) return { error: "Thread could not be created." };

  const { error: mErr } = await supabase.from("dm_messages").insert({
    thread_id: thread.id,
    sender_profile_id: adminProfile.id,
    sender_user_id: adminUser.id,
    body: trimmed,
  });
  if (mErr) return { error: mErr.message };

  await logAdminAction({
    actionType: "send_in_app_message",
    targetType: "user",
    targetId: target.user_id,
    targetLabel: targetProfileId,
    details: { thread_id: thread.id, preview: trimmed.slice(0, 200) },
  });

  revalidatePath(`/admin/users/${target.user_id}`);
  revalidatePath("/inbox");
  return { threadId: thread.id };
}

// ─── Record that admin sent an email (mailto link is client-side) ──────────

export async function adminLogEmailSent(
  targetUserId: string,
  subject: string,
): Promise<void> {
  const guard = await requireAdmin();
  if ("error" in guard) return;

  await logAdminAction({
    actionType: "send_email",
    targetType: "user",
    targetId: targetUserId,
    targetLabel: subject,
  });
  revalidatePath(`/admin/users/${targetUserId}`);
}

// ─── Toggle a profile's publish status (admin override) ────────────────────

export async function adminTogglePublish(
  profileId: string,
  next: boolean,
): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;
  const { supabase } = guard;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id, is_suspended")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return { error: "Profile not found." };
  if (profile.is_suspended && next)
    return { error: "Unsuspend the profile before publishing." };

  const { error } = await supabase
    .from("profiles")
    .update({ is_published: next })
    .eq("id", profileId);
  if (error) return { error: error.message };

  await logAdminAction({
    actionType: next ? "force_publish" : "force_unpublish",
    targetType: "user",
    targetId: profile.user_id,
    targetLabel: profileId,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${profile.user_id}`);
  return {};
}
