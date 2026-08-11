import type { SupabaseClient } from "@supabase/supabase-js";
import { findPlace, resolvePhotoUrl } from "./places";

/**
 * Backfills Google Places photos onto directory listings, a batch at a time.
 *
 * Same shape as the screenshot backfill: only ever picks up rows never looked
 * up (`places_status IS NULL`), records an outcome on every row it touches, and
 * therefore never repeats a billed lookup no matter how often it runs.
 */

export const PLACES_BATCH_SIZE = 25;

export type PlacesJobResult = {
  /** Rows never looked up, before this run. */
  remainingBefore: number;
  attempted: number;
  /** Matched a place and stored a photo. */
  photos: number;
  /** Matched a place that has no photo. */
  noPhoto: number;
  /** Google had no match for the name. */
  notFound: number;
  failed: number;
  dryRun: boolean;
  failures: { businessName: string; reason: string }[];
  error?: string;
};

export type PlacesJobOptions = {
  limit?: number;
  dryRun?: boolean;
  now?: Date;
};

type PendingRow = { id: string; business_name: string };

const emptyResult = (dryRun: boolean): PlacesJobResult => ({
  remainingBefore: 0,
  attempted: 0,
  photos: 0,
  noPhoto: 0,
  notFound: 0,
  failed: 0,
  dryRun,
  failures: [],
});

export async function backfillPlacePhotos(
  supabase: SupabaseClient,
  options: PlacesJobOptions = {},
): Promise<PlacesJobResult> {
  const limit = options.limit ?? PLACES_BATCH_SIZE;
  const dryRun = options.dryRun ?? false;
  const nowIso = (options.now ?? new Date()).toISOString();

  const { count: remainingBefore, error: countError } = await supabase
    .from("directory_businesses")
    .select("id", { count: "exact", head: true })
    .is("places_status", null);

  if (countError) return { ...emptyResult(dryRun), error: countError.message };

  const { data, error: selectError } = await supabase
    .from("directory_businesses")
    .select("id, business_name")
    .is("places_status", null)
    // Highest-visibility listings get photos first, so a partial backfill
    // still improves the top of every page.
    .order("tier_rank", { ascending: true })
    .order("business_name", { ascending: true })
    .limit(limit);

  if (selectError) return { ...emptyResult(dryRun), error: selectError.message };

  const rows = (data ?? []) as PendingRow[];
  const base: PlacesJobResult = {
    ...emptyResult(dryRun),
    remainingBefore: remainingBefore ?? 0,
    attempted: rows.length,
  };

  if (rows.length === 0 || dryRun) return base;

  let photos = 0;
  let noPhoto = 0;
  let notFound = 0;
  let failed = 0;
  const failures: PlacesJobResult["failures"] = [];

  // Sequential on purpose: keeps Places quota usage predictable and makes a
  // mid-batch failure easy to reason about.
  for (const row of rows) {
    const match = await findPlace(row.business_name);

    if (!match.ok) {
      await mark(supabase, row.id, { status: "failed", nowIso });
      failed += 1;
      failures.push({ businessName: row.business_name, reason: match.reason });
      continue;
    }

    if (!match.data) {
      await mark(supabase, row.id, { status: "not_found", nowIso });
      notFound += 1;
      continue;
    }

    if (!match.data.photoName) {
      await mark(supabase, row.id, {
        status: "no_photo",
        nowIso,
        placeId: match.data.placeId,
      });
      noPhoto += 1;
      continue;
    }

    const photo = await resolvePhotoUrl(match.data.photoName);
    if (!photo.ok) {
      // The place matched, so keep what we learned — only the image failed,
      // and a retry can re-resolve from the stored photo name.
      await mark(supabase, row.id, {
        status: "failed",
        nowIso,
        placeId: match.data.placeId,
        photoName: match.data.photoName,
      });
      failed += 1;
      failures.push({ businessName: row.business_name, reason: photo.reason });
      continue;
    }

    await mark(supabase, row.id, {
      status: "done",
      nowIso,
      placeId: match.data.placeId,
      photoName: match.data.photoName,
      photoUrl: photo.data,
    });
    photos += 1;
  }

  return { ...base, photos, noPhoto, notFound, failed, failures };
}

async function mark(
  supabase: SupabaseClient,
  id: string,
  args: {
    status: "done" | "no_photo" | "not_found" | "failed";
    nowIso: string;
    placeId?: string;
    photoName?: string;
    photoUrl?: string;
  },
): Promise<void> {
  await supabase
    .from("directory_businesses")
    .update({
      places_status: args.status,
      places_checked_at: args.nowIso,
      updated_at: args.nowIso,
      ...(args.placeId ? { place_id: args.placeId } : {}),
      ...(args.photoName ? { place_photo_name: args.photoName } : {}),
      ...(args.photoUrl
        ? { place_photo_url: args.photoUrl, place_photo_refreshed_at: args.nowIso }
        : {}),
    })
    .eq("id", id);
}

/** Puts failed lookups back in the queue for an explicit retry. */
export async function resetFailedPlaces(
  supabase: SupabaseClient,
): Promise<{ reset: number; error?: string }> {
  const { count, error } = await supabase
    .from("directory_businesses")
    .update({ places_status: null }, { count: "exact" })
    .eq("places_status", "failed");

  if (error) return { reset: 0, error: error.message };
  return { reset: count ?? 0 };
}
