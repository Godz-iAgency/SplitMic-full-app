import type { MatchCard } from "@/lib/supabase/matchBands";

/**
 * The shape the show-matching form and its server action agree on.
 *
 * Split out of app/match/actions.ts because a "use server" file may only
 * export async functions — a shared constant or type has to live somewhere the
 * client can import without dragging the server action's dependencies (and the
 * Gemini client) into the browser bundle.
 */

/** Long enough for a real brief, short enough to keep the prompt cheap. */
export const DESCRIPTION_MAX = 600;

/** Below this there is nothing to extract, so we skip the model call. */
export const DESCRIPTION_MIN = 15;

export type MatchResponse = {
  cards: MatchCard[];
  /** Chips showing what we understood, so the buyer can see why they got these. */
  understood: {
    genres: string[];
    minDraw: string | null;
    maxMemberCount: number | null;
    keywords: string[];
  };
  /** False when Gemini was unreachable and we ranked on completeness instead. */
  aiUsed: boolean;
  error?: string;
};

export const EMPTY_MATCH_RESPONSE: MatchResponse = {
  cards: [],
  understood: {
    genres: [],
    minDraw: null,
    maxMemberCount: null,
    keywords: [],
  },
  aiUsed: false,
};
