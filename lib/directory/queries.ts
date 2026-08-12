import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DIRECTORY_CATEGORIES,
  type DirectoryCategory,
} from "./categories";

/**
 * Public reads for /directory. Deliberately selects an explicit column list
 * that omits `email` and the outreach fields — the database also blocks those
 * from the public role (see migrations/step11_business_directory.sql), so this
 * is the second of two locks, not the only one.
 */

export type DirectoryCard = {
  id: string;
  category: DirectoryCategory;
  businessName: string;
  websiteUrl: string | null;
  phone: string | null;
  description: string | null;
  subcategory: string | null;
  tier: "standard" | "featured" | "spotlight";
  claimedProfileId: string | null;
  /** Stored website screenshot. Null until the backfill reaches this row. */
  screenshotUrl: string | null;
  /** The business's own Open Graph preview image, when it has one. Free — no
   *  API key, no billing — and preferred over the screenshot when present. */
  ogImageUrl: string | null;
};

/** Safety valve. The largest single category is ~296. */
export const DIRECTORY_MAX_ROWS = 500;

const PUBLIC_COLUMNS =
  "id, category, business_name, website_url, phone, description, subcategory, tier, claimed_profile_id, screenshot_url, og_image_url";

export type DirectoryFilters = {
  category?: DirectoryCategory;
  query?: string;
  /** Exact subcategory match — venue type, band genre, festival season. */
  subcategory?: string;
  limit?: number;
};

export async function getDirectoryBusinesses(
  supabase: SupabaseClient,
  filters: DirectoryFilters = {},
): Promise<DirectoryCard[]> {
  let query = supabase
    .from("directory_businesses")
    .select(PUBLIC_COLUMNS)
    .eq("is_active", true);

  if (filters.category) query = query.eq("category", filters.category);

  const sub = filters.subcategory?.trim();
  if (sub) query = query.eq("subcategory", sub);

  const trimmed = filters.query?.trim();
  if (trimmed) {
    const safe = escapeForOr(trimmed);
    query = query.or(
      `business_name.ilike.%${safe}%,description.ilike.%${safe}%,subcategory.ilike.%${safe}%`,
    );
  }

  const { data, error } = await query
    // tier_rank materializes spotlight(0) < featured(1) < standard(2), which
    // PostgREST can't express as an ORDER BY CASE.
    .order("tier_rank", { ascending: true })
    .order("sort_weight", { ascending: false })
    .order("business_name", { ascending: true })
    .limit(filters.limit ?? DIRECTORY_MAX_ROWS);

  if (error || !data) return [];

  return data.map(
    (row): DirectoryCard => ({
      id: row.id,
      category: row.category,
      businessName: row.business_name,
      websiteUrl: row.website_url,
      phone: row.phone,
      description: row.description,
      subcategory: row.subcategory,
      tier: row.tier,
      claimedProfileId: row.claimed_profile_id,
      screenshotUrl: row.screenshot_url,
      ogImageUrl: row.og_image_url,
    }),
  );
}

/**
 * Distinct subcategory values present in a category, for the filter dropdown.
 *
 * Read from the data rather than hardcoded, because what a subcategory *means*
 * differs per category — venue types, band genres, festival seasons — and the
 * set grows as new listings are imported.
 */
export async function getSubcategoryOptions(
  supabase: SupabaseClient,
  category: DirectoryCategory,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("directory_businesses")
    .select("subcategory")
    .eq("is_active", true)
    .eq("category", category)
    .not("subcategory", "is", null)
    .limit(DIRECTORY_MAX_ROWS);

  if (error || !data) return [];

  const unique = new Set<string>();
  for (const row of data) {
    const value = (row.subcategory as string | null)?.trim();
    if (value) unique.add(value);
  }

  return [...unique].sort((a, b) => a.localeCompare(b));
}

export async function getDirectoryCounts(
  supabase: SupabaseClient,
): Promise<Record<DirectoryCategory | "all", number>> {
  const results = await Promise.all(
    DIRECTORY_CATEGORIES.map(async (category) => {
      const { count } = await supabase
        .from("directory_businesses")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("category", category);
      return [category, count ?? 0] as const;
    }),
  );

  const counts = Object.fromEntries(results) as Record<
    DirectoryCategory | "all",
    number
  >;
  counts.all = results.reduce((sum, [, n]) => sum + n, 0);
  return counts;
}

/**
 * `.or()` takes a raw PostgREST filter string, so commas and parens would
 * break out of the expression, and %/_ are ilike wildcards.
 */
function escapeForOr(value: string): string {
  return value.replace(/[%_,()\\]/g, "");
}
