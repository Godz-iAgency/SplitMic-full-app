import type { SupabaseClient } from "@supabase/supabase-js";
import { mapCsvToBusinesses, type DirectoryBusinessInsert } from "./mapRow";
import { DIRECTORY_CATEGORIES, type DirectoryCategory } from "./categories";

/**
 * Imports the scraped business CSV into directory_businesses.
 *
 * Same contract as lib/events/sync.ts and lib/supabase/maintenance.ts: takes a
 * client so tests can pass a fake, never throws, returns a typed result with
 * an optional `error`.
 *
 * The important property is idempotence. Re-running this after the owner has
 * hand-set tiers and worked the outreach queue must not undo any of it, so an
 * existing row only ever has its SCRAPED fields refreshed — never its tier,
 * outreach state, or claimed-profile link. A blanket upsert would wipe all of
 * that on every run.
 */

/** Fields the scrape owns. Everything else on an existing row is left alone. */
const SCRAPE_OWNED_FIELDS = [
  "business_name",
  "email",
  "website_url",
  "phone",
  "description",
  "subcategory",
] as const;

type ScrapeOwnedField = (typeof SCRAPE_OWNED_FIELDS)[number];

/** Kept well under Postgres' parameter ceiling for a single statement. */
export const IMPORT_BATCH_SIZE = 200;

export type DirectoryImportResult = {
  parsed: number;
  valid: number;
  skippedInvalid: number;
  duplicatesInFile: number;
  toInsert: number;
  toUpdate: number;
  unchanged: number;
  inserted: number;
  updated: number;
  byCategory: Record<DirectoryCategory, number>;
  dryRun: boolean;
  error?: string;
};

export type DirectoryImportOptions = {
  /** Report what would change without writing anything. */
  dryRun?: boolean;
  /** Injectable for tests. Defaults to now. */
  now?: Date;
};

type ExistingRow = { id: string; category: string; name_key: string } & Record<
  ScrapeOwnedField,
  string | null
>;

const emptyByCategory = (): Record<DirectoryCategory, number> =>
  Object.fromEntries(DIRECTORY_CATEGORIES.map((c) => [c, 0])) as Record<
    DirectoryCategory,
    number
  >;

const emptyResult = (dryRun: boolean): DirectoryImportResult => ({
  parsed: 0,
  valid: 0,
  skippedInvalid: 0,
  duplicatesInFile: 0,
  toInsert: 0,
  toUpdate: 0,
  unchanged: 0,
  inserted: 0,
  updated: 0,
  byCategory: emptyByCategory(),
  dryRun,
});

const keyOf = (category: string, nameKey: string) => `${category}||${nameKey}`;

/** True when any scraped field differs from what's already stored. */
function hasScrapeChanges(
  incoming: DirectoryBusinessInsert,
  existing: ExistingRow,
): boolean {
  return SCRAPE_OWNED_FIELDS.some(
    (field) => (incoming[field] ?? null) !== (existing[field] ?? null),
  );
}

export async function importDirectoryBusinesses(
  supabase: SupabaseClient,
  csvText: string,
  options: DirectoryImportOptions = {},
): Promise<DirectoryImportResult> {
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();

  const mapped = mapCsvToBusinesses(csvText);
  if (mapped.parseError) {
    return { ...emptyResult(dryRun), error: mapped.parseError };
  }

  const byCategory = emptyByCategory();
  for (const row of mapped.rows) byCategory[row.category] += 1;

  const base: DirectoryImportResult = {
    ...emptyResult(dryRun),
    parsed:
      mapped.rows.length + mapped.skipped.length + mapped.duplicatesInFile.length,
    valid: mapped.rows.length,
    skippedInvalid: mapped.skipped.length,
    duplicatesInFile: mapped.duplicatesInFile.length,
    byCategory,
  };

  if (mapped.rows.length === 0) return base;

  // One read of what's already there, keyed for lookup.
  const { data: existingRows, error: selectError } = await supabase
    .from("directory_businesses")
    .select(`id, category, name_key, ${SCRAPE_OWNED_FIELDS.join(", ")}`);

  if (selectError) {
    return { ...base, error: selectError.message };
  }

  const existingByKey = new Map<string, ExistingRow>();
  for (const row of (existingRows ?? []) as unknown as ExistingRow[]) {
    existingByKey.set(keyOf(row.category, row.name_key), row);
  }

  const toInsert: DirectoryBusinessInsert[] = [];
  const toUpdate: { id: string; row: DirectoryBusinessInsert }[] = [];
  let unchanged = 0;

  for (const row of mapped.rows) {
    const existing = existingByKey.get(keyOf(row.category, row.name_key));
    if (!existing) {
      toInsert.push(row);
    } else if (hasScrapeChanges(row, existing)) {
      toUpdate.push({ id: existing.id, row });
    } else {
      unchanged += 1;
    }
  }

  const planned: DirectoryImportResult = {
    ...base,
    toInsert: toInsert.length,
    toUpdate: toUpdate.length,
    unchanged,
  };

  if (dryRun) return planned;

  // ── Inserts, batched ──────────────────────────────────────────────────
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += IMPORT_BATCH_SIZE) {
    const batch = toInsert
      .slice(i, i + IMPORT_BATCH_SIZE)
      .map((row) => ({ ...row, last_imported_at: nowIso }));

    const { error } = await supabase.from("directory_businesses").insert(batch);
    if (error) {
      // Report honestly rather than rolling back: the run is idempotent, so
      // re-running picks up exactly where this stopped.
      return { ...planned, inserted, error: error.message };
    }
    inserted += batch.length;
  }

  // ── Updates: scraped fields ONLY ──────────────────────────────────────
  let updated = 0;
  for (const { id, row } of toUpdate) {
    const { error } = await supabase
      .from("directory_businesses")
      .update({
        business_name: row.business_name,
        email: row.email,
        website_url: row.website_url,
        phone: row.phone,
        description: row.description,
        subcategory: row.subcategory,
        source_row: row.source_row,
        last_imported_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id);

    if (error) {
      return { ...planned, inserted, updated, error: error.message };
    }
    updated += 1;
  }

  return { ...planned, inserted, updated };
}
