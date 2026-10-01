import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerType } from "@/lib/types";

// Its own module, with no runtime imports, because both lib/supabase/profile.ts
// and lib/supabase/admin.ts need it and profile.ts already imports admin.ts.
// Living in either one would make the other import a cycle.

/**
 * Where each player type's details live, which column is its display name, and
 * what to call it when that column is blank. The one place a new player type
 * gets wired into name lookups: inbox, feed, admin, and email all resolve names
 * through fetchDisplayNames below rather than each listing the tables again.
 */
export const DETAIL_SOURCE: Record<
  PlayerType,
  { table: string; nameColumn: string; fallbackName: string }
> = {
  band: { table: "band_details", nameColumn: "band_name", fallbackName: "Band" },
  venue: { table: "venue_details", nameColumn: "venue_name", fallbackName: "Venue" },
  talent_buyer: {
    table: "talent_buyer_details",
    nameColumn: "company_name",
    fallbackName: "Talent buyer",
  },
  record_label: {
    table: "record_label_details",
    nameColumn: "label_name",
    fallbackName: "Record label",
  },
  festival: {
    table: "festival_details",
    nameColumn: "festival_name",
    fallbackName: "Festival",
  },
  backline: {
    table: "backline_details",
    nameColumn: "business_name",
    fallbackName: "Backline company",
  },
  instrument_rental: {
    table: "instrument_rental_details",
    nameColumn: "business_name",
    fallbackName: "Instrument rental",
  },
  rehearsal_studio: {
    table: "rehearsal_studio_details",
    nameColumn: "business_name",
    fallbackName: "Rehearsal studio",
  },
};

/**
 * Display name per profile id, read from every detail table in parallel. A
 * profile with no detail row is simply absent from the map, so each caller
 * keeps its own fallback for that case. A table that errors (not migrated yet,
 * say) contributes nothing rather than failing the whole lookup.
 */
export async function fetchDisplayNames(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (profileIds.length === 0) return map;

  const sources = Object.values(DETAIL_SOURCE);
  const results = await Promise.all(
    sources.map((s) =>
      supabase
        .from(s.table)
        .select(`profile_id, ${s.nameColumn}`)
        .in("profile_id", profileIds),
    ),
  );

  results.forEach((result, i) => {
    const { nameColumn, fallbackName } = sources[i];
    for (const row of (result.data ?? []) as unknown as Record<string, unknown>[]) {
      const name = row[nameColumn];
      map.set(
        row.profile_id as string,
        typeof name === "string" && name ? name : fallbackName,
      );
    }
  });
  return map;
}
