/**
 * Dropdown options for the band draw field. These outlived the Band Readiness
 * Score they were first written for: typical draw still feeds
 * the talent-buyer show matcher (lib/ai/showMatch.ts, lib/supabase/matchBands.ts)
 * and the landing page's mini profile builder, so the stored values here are
 * load-bearing. Changing one strands every band row that already holds it.
 */

export type DrawBucket = "0-25" | "25-75" | "75-200" | "200+";

/** Ordered smallest to largest; the show matcher compares by position. */
export const DRAW_OPTIONS: { value: DrawBucket; label: string }[] = [
  { value: "0-25", label: "Up to 25 people" },
  { value: "25-75", label: "25–75 people" },
  { value: "75-200", label: "75–200 people" },
  { value: "200+", label: "200+ people" },
];
