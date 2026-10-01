/**
 * Dropdown options for the band draw and venue-size fields. These outlived the
 * Band Readiness Score they were first written for: typical draw still feeds
 * the talent-buyer show matcher (lib/ai/showMatch.ts, lib/supabase/matchBands.ts)
 * and the landing page's mini profile builder, so the stored values here are
 * load-bearing. Changing one strands every band row that already holds it.
 */

export type DrawBucket = "0-25" | "25-75" | "75-200" | "200+";
export type VenueBucket = "under-100" | "100-300" | "300-1000" | "1000-plus";

/** Ordered smallest to largest; the show matcher compares by position. */
export const DRAW_OPTIONS: { value: DrawBucket; label: string }[] = [
  { value: "0-25", label: "Up to 25 people" },
  { value: "25-75", label: "25–75 people" },
  { value: "75-200", label: "75–200 people" },
  { value: "200+", label: "200+ people" },
];

export const VENUE_OPTIONS: { value: VenueBucket; label: string }[] = [
  { value: "under-100", label: "Under 100 capacity" },
  { value: "100-300", label: "100–300 capacity" },
  { value: "300-1000", label: "300–1,000 capacity" },
  { value: "1000-plus", label: "1,000+ capacity" },
];
