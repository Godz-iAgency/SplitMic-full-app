"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { extractShowCriteria } from "@/lib/ai/showMatch";
import { matchBands } from "@/lib/supabase/matchBands";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  EMPTY_MATCH_RESPONSE,
  type MatchResponse,
} from "@/lib/ai/showMatchContract";

/**
 * Talent-buyer-only. Takes a plain-English show description, has Gemini turn it
 * into structured criteria, then ranks published bands against it with our own
 * data.
 *
 * The player-type check is re-run here rather than trusted from the page: a
 * server action is a public endpoint, and the page-level gate only controls
 * what gets rendered.
 */
export async function findMatchingBands(
  description: string,
): Promise<MatchResponse> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ...EMPTY_MATCH_RESPONSE, error: "Please sign in again." };
  }

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!profile || !isComplete || profile.player_type !== "talent_buyer") {
    return {
      ...EMPTY_MATCH_RESPONSE,
      error: "Show matching is available to talent buyer accounts.",
    };
  }

  const trimmed = description.trim().slice(0, DESCRIPTION_MAX);
  if (trimmed.length < DESCRIPTION_MIN) {
    return {
      ...EMPTY_MATCH_RESPONSE,
      error: "Add a bit more detail about the show you're booking.",
    };
  }

  const { criteria, aiUsed, reason } = await extractShowCriteria(trimmed);

  // Gemini being down is not a dead end: matchBands falls back to ranking by
  // profile completeness, and the UI says so rather than pretending.
  if (!aiUsed && reason) {
    console.error("[show-match] Gemini unavailable:", reason);
  }

  const cards = await matchBands(supabase, criteria);

  return {
    cards,
    understood: {
      genres: criteria.genres,
      minDraw: criteria.minDraw,
      maxMemberCount: criteria.maxMemberCount,
      keywords: criteria.keywords,
    },
    aiUsed,
  };
}
