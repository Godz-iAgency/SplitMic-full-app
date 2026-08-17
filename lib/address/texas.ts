/**
 * Where SplitMic accepts members from.
 *
 * This is the *membership* boundary, and it is deliberately NOT the same as
 * the app's content boundary. Everything the app surfaces — the /live feed,
 * the directory, show matching — stays Austin-focused on purpose. This only
 * governs who may create an account, which was widened from Austin-only after
 * real musicians who play the Austin scene but live in San Antonio, San
 * Marcos, Houston etc. were blocked at signup. A player commuting into Austin
 * for gigs is exactly the person this app is for; their home ZIP shouldn't
 * decide that.
 *
 * Canonical source for the rule — imported by the onboarding step and the
 * address-validation route so the two can't drift apart.
 */

/**
 * Texas ZIP ranges. The state's allocation is the contiguous 75000-79999
 * block plus a separate 885xx block for the El Paso area, which sits apart
 * because it shares a sorting hub with New Mexico.
 *
 * Deliberately excludes 73301/73344 — those are Austin ZIPs, but they belong
 * to an IRS processing facility, not to anywhere a person lives.
 */
const TEXAS_ZIP_RANGES: readonly (readonly [number, number])[] = [
  [75000, 79999],
  [88500, 88599],
] as const;

export function isValidTexasZip(zip: string): boolean {
  if (!/^\d{5}$/.test(zip)) return false;
  const n = Number(zip);
  return TEXAS_ZIP_RANGES.some(([low, high]) => n >= low && n <= high);
}

/** Shown wherever a ZIP is rejected, so the constraint reads the same everywhere. */
export const TEXAS_ZIP_HELP = "Enter a valid Texas ZIP code.";
