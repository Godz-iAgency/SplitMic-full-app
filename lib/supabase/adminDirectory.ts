import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DIRECTORY_CATEGORIES,
  type DirectoryCategory,
} from "@/lib/directory/categories";

/**
 * Admin-side reads for the business directory. Kept out of lib/supabase/admin.ts,
 * which is already large and covers user/post moderation.
 *
 * Everything here runs on a service-role client, so it sees the columns the
 * public grants deliberately withhold (email, outreach pipeline).
 */

export type OutreachStatus =
  | "not_contacted"
  | "contacted"
  | "responded"
  | "signed_up"
  | "do_not_contact";

export type DirectoryTier = "standard" | "featured" | "spotlight";

export const OUTREACH_STATUSES: readonly OutreachStatus[] = [
  "not_contacted",
  "contacted",
  "responded",
  "signed_up",
  "do_not_contact",
] as const;

export const OUTREACH_LABELS: Record<OutreachStatus, string> = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  responded: "Responded",
  signed_up: "Signed up",
  do_not_contact: "Do not contact",
};

export const DIRECTORY_TIERS: readonly DirectoryTier[] = [
  "standard",
  "featured",
  "spotlight",
] as const;

export type AdminDirectoryRow = {
  id: string;
  category: DirectoryCategory;
  businessName: string;
  email: string | null;
  websiteUrl: string | null;
  phone: string | null;
  description: string | null;
  subcategory: string | null;
  tier: DirectoryTier;
  outreachStatus: OutreachStatus;
  outreachNotes: string | null;
  lastContactedAt: string | null;
  claimedProfileId: string | null;
  isActive: boolean;
};

export type AdminDirectoryFilters = {
  category?: DirectoryCategory;
  tier?: DirectoryTier;
  outreach?: OutreachStatus;
  query?: string;
  /** "has" / "none" — narrow to rows that can (or can't) be emailed. */
  email?: "has" | "none";
  claimed?: "yes" | "no";
};

/** One screen's worth. The full table is ~584 rows; filters narrow it. */
export const ADMIN_DIRECTORY_PAGE_SIZE = 200;

export type AdminDirectoryPage = {
  rows: AdminDirectoryRow[];
  total: number;
  truncated: boolean;
};

export async function getAdminDirectoryRows(
  supabase: SupabaseClient,
  filters: AdminDirectoryFilters = {},
): Promise<AdminDirectoryPage> {
  let query = supabase
    .from("directory_businesses")
    .select(
      "id, category, business_name, email, website_url, phone, description, subcategory, tier, tier_rank, outreach_status, outreach_notes, last_contacted_at, claimed_profile_id, is_active",
      { count: "exact" },
    );

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.tier) query = query.eq("tier", filters.tier);
  if (filters.outreach) query = query.eq("outreach_status", filters.outreach);
  if (filters.email === "has") query = query.not("email", "is", null);
  if (filters.email === "none") query = query.is("email", null);
  if (filters.claimed === "yes") query = query.not("claimed_profile_id", "is", null);
  if (filters.claimed === "no") query = query.is("claimed_profile_id", null);

  const trimmed = filters.query?.trim();
  if (trimmed) {
    query = query.ilike("business_name", `%${escapeLike(trimmed)}%`);
  }

  const { data, count, error } = await query
    .order("tier_rank", { ascending: true })
    .order("business_name", { ascending: true })
    .limit(ADMIN_DIRECTORY_PAGE_SIZE);

  if (error || !data) return { rows: [], total: 0, truncated: false };

  const rows = data.map(
    (row): AdminDirectoryRow => ({
      id: row.id,
      category: row.category,
      businessName: row.business_name,
      email: row.email,
      websiteUrl: row.website_url,
      phone: row.phone,
      description: row.description,
      subcategory: row.subcategory,
      tier: row.tier,
      outreachStatus: row.outreach_status,
      outreachNotes: row.outreach_notes,
      lastContactedAt: row.last_contacted_at,
      claimedProfileId: row.claimed_profile_id,
      isActive: row.is_active,
    }),
  );

  const total = count ?? rows.length;
  return { rows, total, truncated: total > rows.length };
}

/** Row counts per category, for the import panel's before/after picture. */
export async function getAdminDirectoryCounts(
  supabase: SupabaseClient,
): Promise<{ total: number; byCategory: Record<DirectoryCategory, number> }> {
  const results = await Promise.all(
    DIRECTORY_CATEGORIES.map(async (category) => {
      const { count } = await supabase
        .from("directory_businesses")
        .select("id", { count: "exact", head: true })
        .eq("category", category);
      return [category, count ?? 0] as const;
    }),
  );

  const byCategory = Object.fromEntries(results) as Record<
    DirectoryCategory,
    number
  >;
  const total = results.reduce((sum, [, n]) => sum + n, 0);
  return { total, byCategory };
}

/**
 * Screenshot backfill progress, for the admin panel's counters.
 *
 * `pending` mirrors backfillScreenshots' own selection exactly, including its
 * og_image_url filter — otherwise the panel would advertise work the job will
 * never do (a listing that already has a free photo is deliberately skipped),
 * and the number would never reach zero.
 */
export async function getScreenshotProgress(
  supabase: SupabaseClient,
): Promise<{ done: number; pending: number; failed: number }> {
  const table = () =>
    supabase.from("directory_businesses").select("id", { count: "exact", head: true });

  const [done, pending, failed] = await Promise.all([
    table().eq("screenshot_status", "done"),
    table().is("screenshot_status", null).is("og_image_url", null),
    table().eq("screenshot_status", "failed"),
  ]);

  return {
    done: done.count ?? 0,
    pending: pending.count ?? 0,
    failed: failed.count ?? 0,
  };
}

/** Open Graph image backfill progress, for the admin panel's counters. */
export async function getOgImageProgress(
  supabase: SupabaseClient,
): Promise<{ done: number; pending: number; failed: number }> {
  const table = () =>
    supabase.from("directory_businesses").select("id", { count: "exact", head: true });

  const [done, pending, failed] = await Promise.all([
    table().eq("og_image_status", "done"),
    table().is("og_image_status", null),
    table().eq("og_image_status", "failed"),
  ]);

  return {
    done: done.count ?? 0,
    pending: pending.count ?? 0,
    failed: failed.count ?? 0,
  };
}

/** Website liveness check progress, for the admin panel's counters. */
export async function getWebsiteCheckProgress(
  supabase: SupabaseClient,
): Promise<{ live: number; dead: number; uncertain: number; noWebsite: number; pending: number }> {
  const table = () =>
    supabase.from("directory_businesses").select("id", { count: "exact", head: true });

  const [live, dead, uncertain, noWebsite, pending] = await Promise.all([
    table().eq("website_status", "live"),
    table().eq("website_status", "dead"),
    table().eq("website_status", "uncertain"),
    table().eq("website_status", "no_website"),
    table().is("website_status", null),
  ]);

  return {
    live: live.count ?? 0,
    dead: dead.count ?? 0,
    uncertain: uncertain.count ?? 0,
    noWebsite: noWebsite.count ?? 0,
    pending: pending.count ?? 0,
  };
}

export type DeadListingRow = {
  id: string;
  businessName: string;
  category: DirectoryCategory;
  websiteUrl: string | null;
  reason: string | null;
  checkedAt: string | null;
};

/** Still-active listings confirmed dead, for the panel's review list before deactivating. */
export async function getDeadListings(
  supabase: SupabaseClient,
  limit = 50,
): Promise<DeadListingRow[]> {
  const { data, error } = await supabase
    .from("directory_businesses")
    .select("id, business_name, category, website_url, website_check_reason, website_checked_at")
    .eq("website_status", "dead")
    .eq("is_active", true)
    .order("website_checked_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    businessName: row.business_name,
    category: row.category,
    websiteUrl: row.website_url,
    reason: row.website_check_reason,
    checkedAt: row.website_checked_at,
  }));
}

/** PostgREST treats these as wildcards inside an ilike pattern. */
function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}
