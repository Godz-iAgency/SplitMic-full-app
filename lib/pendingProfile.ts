import { GENRES } from "@/lib/genres";
import { DRAW_OPTIONS } from "@/lib/scoring/bandReadiness";
import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";

/**
 * Answers collected by the landing page's mini profile builder, before the
 * signup wall.
 *
 * IKEA effect: a visitor who has already picked their genres and their scale
 * has built part of the thing, so the email/password screen reads as finishing
 * something rather than starting it. The answers ride along in localStorage and
 * land pre-filled in onboarding.
 *
 * Every question maps 1:1 onto a field the player type already has, so nothing
 * here is invented on the user's behalf. Genres go to that type's genre array;
 * `scale` goes to the single discrete field that best describes their size or
 * kind (bands answer with typical draw, everyone else with what kind of
 * operation they run).
 */

export const PENDING_PROFILE_KEY = "splitmic_pending_profile";

/** Pre-mini-builder key: a bare player-type string. Still read (never written)
 *  so a signup started before this shipped doesn't lose the type. */
export const LEGACY_PENDING_TYPE_KEY = "splitmic_pending_type";

/** Kept low on purpose: the mini builder is a warm-up, not the real form. */
export const MINI_GENRE_MAX = 3;

export type PendingProfile = {
  type: PlayerType;
  genres: string[];
  /** "" when skipped. Always one of the type's own scaleOptions values. */
  scale: string;
};

export type ScaleOption = { value: string; label: string };

export type MiniQuestions = {
  genreLabel: string;
  scaleLabel: string;
  scaleHint: string;
  scaleOptions: ScaleOption[];
};

/**
 * The two questions each player type is asked, and the exact option values
 * they resolve to. These values must stay in sync with the matching field in
 * components/onboarding/forms/*Form.tsx, since they are written straight into
 * that form's state (see specificFromPending in ProfileStep).
 */
export const MINI_QUESTIONS: Record<PlayerType, MiniQuestions> = {
  band: {
    genreLabel: "What do you play?",
    scaleLabel: "How many people do you usually draw?",
    scaleHint: "The first thing talent buyers ask. Most Austin acts starting out pick 25 to 75.",
    scaleOptions: DRAW_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
  venue: {
    genreLabel: "What do you host?",
    scaleLabel: "What kind of room is it?",
    scaleHint: "Bands filter by this when they're looking for a fit.",
    scaleOptions: [
      { value: "bar", label: "Bar" },
      { value: "concert_hall", label: "Concert Hall" },
      { value: "club", label: "Club" },
      { value: "restaurant", label: "Restaurant" },
      { value: "outdoor", label: "Outdoor Stage" },
      { value: "other", label: "Other" },
    ],
  },
  talent_buyer: {
    genreLabel: "What do you book?",
    scaleLabel: "What kind of booking work do you do?",
    scaleHint: "Tells bands how you fit into the scene.",
    scaleOptions: [
      { value: "booking_agent", label: "Booking Agent" },
      { value: "promoter", label: "Promoter" },
      { value: "event_planner", label: "Event Planner" },
      { value: "other", label: "Other" },
    ],
  },
  record_label: {
    genreLabel: "What do you sign?",
    scaleLabel: "What kind of label are you?",
    scaleHint: "Bands use this to know what kind of deal to expect.",
    scaleOptions: [
      { value: "indie", label: "Independent" },
      { value: "major", label: "Major" },
      { value: "distributed", label: "Distributed" },
      { value: "other", label: "Other" },
    ],
  },
  festival: {
    genreLabel: "What do you feature?",
    scaleLabel: "What kind of festival is it?",
    scaleHint: "Helps bands picture the slot they'd be applying for.",
    scaleOptions: [
      { value: "single_day", label: "Single Day" },
      { value: "multi_day", label: "Multi-Day" },
      { value: "multi_stage", label: "Multi-Stage" },
      { value: "outdoor", label: "Outdoor" },
      { value: "indoor", label: "Indoor" },
      { value: "other", label: "Other" },
    ],
  },
};

const GENRE_SET = new Set<string>(GENRES);
const PLAYER_TYPE_SET = new Set<string>(
  PLAYER_TYPE_OPTIONS.map((o) => o.value),
);

export function isPlayerType(value: unknown): value is PlayerType {
  return typeof value === "string" && PLAYER_TYPE_SET.has(value);
}

/**
 * Read back what the mini builder saved.
 *
 * Everything is re-validated against the current option lists rather than
 * trusted: localStorage is editable, and an entry written before a deploy can
 * name a genre or option that no longer exists. Anything unrecognized is
 * dropped instead of failing, so a stale entry degrades to an empty form.
 */
export function readPendingProfile(): PendingProfile | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_PROFILE_KEY);
  } catch {
    return null; // storage disabled
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const candidate = parsed as Record<string, unknown>;
  if (!isPlayerType(candidate.type)) return null;

  const genres = Array.isArray(candidate.genres)
    ? candidate.genres
        .filter((g): g is string => typeof g === "string" && GENRE_SET.has(g))
        .slice(0, MINI_GENRE_MAX)
    : [];

  const validScales = new Set(
    MINI_QUESTIONS[candidate.type].scaleOptions.map((o) => o.value),
  );
  const scale =
    typeof candidate.scale === "string" && validScales.has(candidate.scale)
      ? candidate.scale
      : "";

  return { type: candidate.type, genres, scale };
}

export function writePendingProfile(pending: PendingProfile): void {
  try {
    localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(pending));
  } catch {
    // Storage unavailable. The ?type= URL param still carries the player type,
    // so signup works; only the mini-builder answers are lost.
  }
}

/** Called once the profile step saves, so a finished profile isn't re-seeded. */
export function clearPendingProfile(): void {
  try {
    localStorage.removeItem(PENDING_PROFILE_KEY);
    localStorage.removeItem(LEGACY_PENDING_TYPE_KEY);
  } catch {
    // ignore
  }
}

export function readLegacyPendingType(): PlayerType | null {
  try {
    const value = localStorage.getItem(LEGACY_PENDING_TYPE_KEY);
    return isPlayerType(value) ? value : null;
  } catch {
    return null;
  }
}
