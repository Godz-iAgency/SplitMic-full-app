// ─────────────────────────────────────────────────────────────────────────────
// Band Readiness Score — pure, hardcoded scoring logic (NO AI).
//
// Same inputs always produce the same score. Each criterion also produces a
// plain-English "detail" (current state) and "advice" (the next step to improve),
// so the band's private breakdown panel needs no extra logic — it just renders
// what this function returns.
//
// Total = 10 points:
//   Profile completeness ....... 2.0
//   Typical draw ............... 2.0
//   Instagram followers ........ 1.5
//   Email list size ............ 1.5
//   Largest venue played ....... 1.5
//   TikTok / YouTube reach ..... 1.5
// ─────────────────────────────────────────────────────────────────────────────

export type DrawBucket = "0-25" | "25-75" | "75-200" | "200+";
export type VenueBucket = "under-100" | "100-300" | "300-1000" | "1000-plus";

/** Dropdown options for the "typical draw" field (edit + onboarding forms). */
export const DRAW_OPTIONS: { value: DrawBucket; label: string }[] = [
  { value: "0-25", label: "Up to 25 people" },
  { value: "25-75", label: "25–75 people" },
  { value: "75-200", label: "75–200 people" },
  { value: "200+", label: "200+ people" },
];

/** Dropdown options for the "largest venue played" field. */
export const VENUE_OPTIONS: { value: VenueBucket; label: string }[] = [
  { value: "under-100", label: "Under 100 capacity" },
  { value: "100-300", label: "100–300 capacity" },
  { value: "300-1000", label: "300–1,000 capacity" },
  { value: "1000-plus", label: "1,000+ capacity" },
];

export type BandScoreInput = {
  // From the profiles row
  bio: string | null;
  instagram_followers: number | null;
  hasAvatar: boolean;
  // From band_details
  genres: string[] | null;
  sound_description: string | null;
  set_length_minutes: number | null;
  email_list_size: number | null;
  typical_draw: string | null;
  largest_venue_capacity: string | null;
  tiktok_followers: number | null;
  youtube_followers: number | null;
};

export type Criterion = {
  key: string;
  label: string;
  points: number;
  max: number;
  /** Current state, e.g. "3,200 Instagram followers". */
  detail: string;
  /** Next step to gain points. Empty string when the criterion is maxed out. */
  advice: string;
};

export type BandReadiness = {
  /** 0–10, rounded to one decimal. */
  score: number;
  max: number;
  criteria: Criterion[];
};

const nf = (n: number) => n.toLocaleString("en-US");

/** Round to one decimal place (avoids 7.30000001 float noise). */
const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeBandReadiness(input: BandScoreInput): BandReadiness {
  const criteria: Criterion[] = [
    scoreCompleteness(input),
    scoreDraw(input.typical_draw),
    scoreInstagram(input.instagram_followers),
    scoreEmailList(input.email_list_size),
    scoreLargestVenue(input.largest_venue_capacity),
    scoreSecondarySocial(input.tiktok_followers, input.youtube_followers),
  ];

  const total = criteria.reduce((sum, c) => sum + c.points, 0);
  return { score: round1(total), max: 10, criteria };
}

// ── Profile completeness (2.0) ──────────────────────────────────────────────
function scoreCompleteness(input: BandScoreInput): Criterion {
  const items: { ok: boolean; missing: string }[] = [
    { ok: !!input.bio?.trim(), missing: "a bio" },
    { ok: (input.genres?.length ?? 0) > 0, missing: "your genres" },
    { ok: !!input.sound_description?.trim(), missing: "a sound description" },
    { ok: (input.set_length_minutes ?? 0) > 0, missing: "your set length" },
    { ok: input.hasAvatar, missing: "a profile photo" },
  ];
  const done = items.filter((i) => i.ok).length;
  const max = 2;
  const points = round1((done / items.length) * max);
  const missing = items.filter((i) => !i.ok).map((i) => i.missing);

  return {
    key: "completeness",
    label: "Profile completeness",
    points,
    max,
    detail: `${done} of ${items.length} profile essentials complete.`,
    advice:
      missing.length === 0
        ? ""
        : `Add ${joinList(missing)} in Edit Profile to finish this out.`,
  };
}

// ── Typical draw (2.0) — the #1 thing talent buyers ask ─────────────────────
function scoreDraw(bucket: string | null): Criterion {
  const max = 2;
  const map: Record<DrawBucket, { points: number; label: string }> = {
    "0-25": { points: 0, label: "up to 25 people" },
    "25-75": { points: 0.5, label: "25–75 people" },
    "75-200": { points: 1.5, label: "75–200 people" },
    "200+": { points: 2, label: "200+ people" },
  };
  const entry = bucket ? map[bucket as DrawBucket] : undefined;

  if (!entry) {
    return {
      key: "draw",
      label: "Typical draw",
      points: 0,
      max,
      detail: "No typical draw added yet.",
      advice:
        "Add how many people you typically draw. It's the first thing talent buyers look at.",
    };
  }

  const advice =
    entry.points >= max
      ? ""
      : bucket === "0-25"
        ? "Grow your typical draw past 25 to start earning points here."
        : bucket === "25-75"
          ? "Reach a 75+ typical draw to jump to 1.5 points."
          : "Reach a 200+ typical draw to max this out at 2 points.";

  return {
    key: "draw",
    label: "Typical draw",
    points: entry.points,
    max,
    detail: `You typically draw ${entry.label}.`,
    advice,
  };
}

// ── Instagram followers (1.5) ───────────────────────────────────────────────
function scoreInstagram(followers: number | null): Criterion {
  const max = 1.5;
  const f = followers ?? 0;
  const { points, advice } = tier(f, max, [
    { min: 10000, points: 1.5, next: "" },
    { min: 2000, points: 1, next: "Reach 10,000 followers for the full 1.5 points." },
    { min: 500, points: 0.5, next: "Reach 2,000 followers to earn 1 point." },
    { min: 0, points: 0, next: "Reach 500 followers to start earning points here." },
  ]);

  return {
    key: "instagram",
    label: "Instagram followers",
    points,
    max,
    detail: followers
      ? `${nf(followers)} Instagram followers.`
      : "No Instagram followers added.",
    advice:
      points >= max
        ? ""
        : followers
          ? advice
          : "Add your Instagram + follower count in Edit Profile.",
  };
}

// ── Email list size (1.5) ───────────────────────────────────────────────────
function scoreEmailList(size: number | null): Criterion {
  const max = 1.5;
  const s = size ?? 0;
  const { points, advice } = tier(s, max, [
    { min: 1000, points: 1.5, next: "" },
    { min: 200, points: 1, next: "Grow to 1,000 subscribers for the full 1.5 points." },
    { min: 1, points: 0.5, next: "Grow to 200 subscribers to earn 1 point." },
    { min: 0, points: 0, next: "Even 1–200 subscribers earns 0.5 points. Add yours in Edit Profile." },
  ]);

  return {
    key: "email",
    label: "Email list",
    points,
    max,
    detail: size ? `${nf(size)} email subscribers.` : "No email list added.",
    advice: points >= max ? "" : advice,
  };
}

// ── Largest venue played (1.5) ──────────────────────────────────────────────
function scoreLargestVenue(bucket: string | null): Criterion {
  const max = 1.5;
  const map: Record<VenueBucket, { points: number; label: string }> = {
    "under-100": { points: 0.5, label: "under 100 capacity" },
    "100-300": { points: 1, label: "100–300 capacity" },
    "300-1000": { points: 1.5, label: "300–1,000 capacity" },
    "1000-plus": { points: 1.5, label: "1,000+ capacity" },
  };
  const entry = bucket ? map[bucket as VenueBucket] : undefined;

  if (!entry) {
    return {
      key: "venue",
      label: "Largest venue played",
      points: 0,
      max,
      detail: "No venue experience added yet.",
      advice: "Add the largest venue you've played in Edit Profile.",
    };
  }

  const advice =
    entry.points >= max
      ? ""
      : bucket === "under-100"
        ? "Play a 100–300 cap room to reach 1 point, or 300+ to max this out."
        : "Play a 300+ cap room to max this out at 1.5 points.";

  return {
    key: "venue",
    label: "Largest venue played",
    points: entry.points,
    max,
    detail: `You've played ${entry.label} venues.`,
    advice,
  };
}

// ── TikTok / YouTube reach (1.5) — higher of the two ────────────────────────
function scoreSecondarySocial(
  tiktok: number | null,
  youtube: number | null,
): Criterion {
  const max = 1.5;
  const best = Math.max(tiktok ?? 0, youtube ?? 0);
  const platform =
    (tiktok ?? 0) >= (youtube ?? 0) ? "TikTok" : "YouTube";

  const { points, advice } = tier(best, max, [
    { min: 25000, points: 1.5, next: "" },
    { min: 5000, points: 1, next: "Reach 25,000 for the full 1.5 points." },
    { min: 500, points: 0.5, next: "Reach 5,000 to earn 1 point." },
    { min: 0, points: 0, next: "Reach 500 to start earning points here." },
  ]);

  return {
    key: "secondary_social",
    label: "TikTok / YouTube reach",
    points,
    max,
    detail:
      best > 0
        ? `${nf(best)} ${platform} followers (your stronger platform).`
        : "No TikTok or YouTube following added.",
    advice:
      points >= max
        ? ""
        : best > 0
          ? advice
          : "Add your TikTok or YouTube follower count in Edit Profile.",
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Pick the matching tier (first whose `min` <= value) and its advice. */
function tier(
  value: number,
  max: number,
  tiers: { min: number; points: number; next: string }[],
): { points: number; advice: string } {
  for (const t of tiers) {
    if (value >= t.min) {
      return { points: Math.min(t.points, max), advice: t.next };
    }
  }
  return { points: 0, advice: "" };
}

/** "a, b and c" */
function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
