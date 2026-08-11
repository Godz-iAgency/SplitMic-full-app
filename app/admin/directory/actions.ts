"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAdminEmail } from "@/lib/supabase/admin";
import {
  importDirectoryBusinesses,
  type DirectoryImportResult,
} from "@/lib/directory/import";
import { readDirectoryCsvFromDisk } from "@/lib/directory/csvFile";
import {
  backfillScreenshots,
  resetFailedScreenshots,
  SCREENSHOT_BATCH_SIZE,
  type ScreenshotJobResult,
} from "@/lib/directory/screenshotJob";
import { CATEGORY_META } from "@/lib/directory/categories";
import type {
  DirectoryTier,
  OutreachStatus,
} from "@/lib/supabase/adminDirectory";

/**
 * Admin actions for the business directory. Same shape as app/admin/actions.ts:
 * verify identity with the cookie session client, and only then hand back a
 * service-role client so the write actually lands (RLS grants no write policy
 * to anyone on this table).
 */

async function requireAdmin() {
  const sessionClient = createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return { error: "Not authorized." as const };
  }
  return { supabase: createServiceRoleClient(), user };
}

async function logAdminAction(args: {
  actionType: string;
  targetId?: string;
  targetLabel?: string;
  details?: Record<string, unknown>;
}) {
  const sessionClient = createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return;
  await createServiceRoleClient()
    .from("admin_action_log")
    .insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action_type: args.actionType,
      target_type: "directory_business",
      target_id: args.targetId ?? null,
      target_label: args.targetLabel ?? null,
      details: args.details ?? null,
    });
}

/** Public pages that show directory data, refreshed after any write. */
function revalidateDirectory(categorySlug?: string) {
  revalidatePath("/admin/directory");
  revalidatePath("/directory");
  if (categorySlug) revalidatePath(`/directory/${categorySlug}`);
}

// ─── Import ─────────────────────────────────────────────────────────────────

export async function adminRunDirectoryImport(input: {
  dryRun: boolean;
  csvText?: string;
}): Promise<DirectoryImportResult & { error?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return {
      parsed: 0,
      valid: 0,
      skippedInvalid: 0,
      duplicatesInFile: 0,
      toInsert: 0,
      toUpdate: 0,
      unchanged: 0,
      inserted: 0,
      updated: 0,
      byCategory: {} as DirectoryImportResult["byCategory"],
      dryRun: input.dryRun,
      error: guard.error,
    };
  }

  let csvText = input.csvText?.trim();
  if (!csvText) {
    const fromDisk = await readDirectoryCsvFromDisk();
    if (!fromDisk.ok) {
      return {
        parsed: 0,
        valid: 0,
        skippedInvalid: 0,
        duplicatesInFile: 0,
        toInsert: 0,
        toUpdate: 0,
        unchanged: 0,
        inserted: 0,
        updated: 0,
        byCategory: {} as DirectoryImportResult["byCategory"],
        dryRun: input.dryRun,
        error: fromDisk.reason,
      };
    }
    csvText = fromDisk.text;
  }

  const result = await importDirectoryBusinesses(guard.supabase, csvText, {
    dryRun: input.dryRun,
  });

  if (!input.dryRun) {
    await logAdminAction({
      actionType: "directory_import",
      details: {
        inserted: result.inserted,
        updated: result.updated,
        unchanged: result.unchanged,
        error: result.error ?? null,
      },
    });
    revalidateDirectory();
  }

  return result;
}

// ─── Screenshots ────────────────────────────────────────────────────────────

/**
 * Captures website screenshots for listings that don't have one yet.
 *
 * Batched and resumable — each call costs one Firecrawl credit per listing
 * attempted, so the batch size is capped and the caller decides when to run
 * another. Rows already attempted are never picked up again.
 */
export async function adminBackfillScreenshots(input: {
  limit?: number;
  dryRun?: boolean;
}): Promise<ScreenshotJobResult> {
  const guard = await requireAdmin();
  if ("error" in guard) {
    return {
      remainingBefore: 0,
      attempted: 0,
      captured: 0,
      failed: 0,
      skipped: 0,
      dryRun: Boolean(input.dryRun),
      failures: [],
      error: guard.error,
    };
  }

  // Clamp so a hand-edited request can't launch an unbounded spend.
  const limit = Math.min(Math.max(input.limit ?? SCREENSHOT_BATCH_SIZE, 1), 100);

  const result = await backfillScreenshots(guard.supabase, {
    limit,
    dryRun: input.dryRun,
  });

  if (!input.dryRun && result.captured > 0) {
    await logAdminAction({
      actionType: "directory_screenshots",
      details: { captured: result.captured, failed: result.failed },
    });
    revalidateDirectory();
  }

  return result;
}

/** Puts previously-failed rows back in the queue for an explicit retry. */
export async function adminResetFailedScreenshots(): Promise<{
  reset: number;
  error?: string;
}> {
  const guard = await requireAdmin();
  if ("error" in guard) return { reset: 0, error: guard.error };

  const result = await resetFailedScreenshots(guard.supabase);
  if (!result.error) revalidatePath("/admin/directory");
  return result;
}

// ─── Per-row curation ───────────────────────────────────────────────────────

export async function adminSetDirectoryTier(
  businessId: string,
  tier: DirectoryTier,
): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;

  const { data: row } = await guard.supabase
    .from("directory_businesses")
    .select("business_name, category")
    .eq("id", businessId)
    .maybeSingle();

  const { error } = await guard.supabase
    .from("directory_businesses")
    .update({ tier, updated_at: new Date().toISOString() })
    .eq("id", businessId);

  if (error) return { error: error.message };

  await logAdminAction({
    actionType: "directory_set_tier",
    targetId: businessId,
    targetLabel: row?.business_name,
    details: { tier },
  });
  revalidateDirectory(row ? CATEGORY_META[row.category as keyof typeof CATEGORY_META]?.slug : undefined);
  return {};
}

export async function adminSetDirectoryOutreach(
  businessId: string,
  input: { status: OutreachStatus; notes?: string; markContactedNow?: boolean },
): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    outreach_status: input.status,
    outreach_notes: input.notes?.trim() || null,
    updated_at: nowIso,
  };
  // Stamp the contact time when outreach actually goes out, so the queue can
  // be sorted by how stale a follow-up is.
  if (input.markContactedNow || input.status === "contacted") {
    patch.last_contacted_at = nowIso;
  }

  const { error } = await guard.supabase
    .from("directory_businesses")
    .update(patch)
    .eq("id", businessId);

  if (error) return { error: error.message };

  await logAdminAction({
    actionType: "directory_set_outreach",
    targetId: businessId,
    details: { status: input.status },
  });
  revalidatePath("/admin/directory");
  return {};
}

export async function adminToggleDirectoryActive(
  businessId: string,
  next: boolean,
): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;

  const { data: row } = await guard.supabase
    .from("directory_businesses")
    .select("business_name, category")
    .eq("id", businessId)
    .maybeSingle();

  const { error } = await guard.supabase
    .from("directory_businesses")
    .update({ is_active: next, updated_at: new Date().toISOString() })
    .eq("id", businessId);

  if (error) return { error: error.message };

  await logAdminAction({
    actionType: next ? "directory_activate" : "directory_deactivate",
    targetId: businessId,
    targetLabel: row?.business_name,
  });
  revalidateDirectory(row ? CATEGORY_META[row.category as keyof typeof CATEGORY_META]?.slug : undefined);
  return {};
}

/** Links a scraped listing to a real SplitMic profile once they sign up. */
export async function adminLinkDirectoryProfile(
  businessId: string,
  profileId: string | null,
): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if ("error" in guard) return guard;

  const trimmed = profileId?.trim() || null;

  if (trimmed) {
    const { data: profile } = await guard.supabase
      .from("profiles")
      .select("id")
      .eq("id", trimmed)
      .maybeSingle();
    if (!profile) return { error: "No profile with that ID." };
  }

  const { data: row } = await guard.supabase
    .from("directory_businesses")
    .select("business_name, category, outreach_status")
    .eq("id", businessId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    claimed_profile_id: trimmed,
    claimed_at: trimmed ? nowIso : null,
    updated_at: nowIso,
  };
  // A claim is the end state of outreach — reflect that automatically.
  if (trimmed) patch.outreach_status = "signed_up";

  const { error } = await guard.supabase
    .from("directory_businesses")
    .update(patch)
    .eq("id", businessId);

  if (error) return { error: error.message };

  await logAdminAction({
    actionType: trimmed ? "directory_link_profile" : "directory_unlink_profile",
    targetId: businessId,
    targetLabel: row?.business_name,
    details: { profileId: trimmed },
  });
  revalidateDirectory(row ? CATEGORY_META[row.category as keyof typeof CATEGORY_META]?.slug : undefined);
  return {};
}
