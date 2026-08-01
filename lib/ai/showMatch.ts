import { GENRES } from "@/lib/genres";
import { DRAW_OPTIONS } from "@/lib/scoring/bandReadiness";
import { generateJson, type GeminiSchema } from "@/lib/ai/gemini";

/**
 * Turns a talent buyer's plain-English show description into the structured
 * criteria our band query already understands.
 *
 * Gemini's ONLY job here is `natural language → filter object`. It never sees
 * band data, never ranks anyone, and never writes copy the buyer reads as fact.
 * Matching and ranking run entirely on our own profile data (lib/supabase/
 * matchBands.ts), so a bad or unavailable model degrades the results rather
 * than inventing them.
 */

/**
 * Draw buckets, smallest first. Index doubles as the ordering for "at least".
 * Widened to string[] on purpose: it is compared against DB values and model
 * output, neither of which is narrowed to DrawBucket at the point of use.
 */
export const DRAW_ORDER: string[] = DRAW_OPTIONS.map((o) => o.value);

export type ShowCriteria = {
  /** Always a subset of GENRES. Empty means "no genre preference stated". */
  genres: string[];
  /** A DRAW_ORDER value: the smallest draw bucket that still fits. */
  minDraw: string | null;
  /** Upper bound on band size, e.g. "solo or duo" → 2. */
  maxMemberCount: number | null;
  /** Free words worth matching against a band's sound description. */
  keywords: string[];
};

export const EMPTY_CRITERIA: ShowCriteria = {
  genres: [],
  minDraw: null,
  maxMemberCount: null,
  keywords: [],
};

const SCHEMA: GeminiSchema = {
  type: "object",
  properties: {
    genres: {
      type: "array",
      description:
        "Genres implied by the description. Only genres explicitly implied, never a guess to fill space.",
      items: { type: "string", enum: [...GENRES] },
    },
    minDraw: {
      type: "string",
      description:
        "Smallest acceptable crowd-draw bucket, or omit when the description says nothing about crowd size.",
      enum: [...DRAW_ORDER],
      nullable: true,
    },
    maxMemberCount: {
      type: "integer",
      description:
        "Largest band size that still fits (solo=1, duo=2, trio=3). Omit unless the description limits band size.",
      nullable: true,
    },
    keywords: {
      type: "array",
      description:
        "Up to 5 lowercase single words describing sound or vibe (e.g. mellow, loud, acoustic). No genre names, no city names.",
      items: { type: "string" },
    },
  },
  required: ["genres", "keywords"],
};

function buildPrompt(description: string): string {
  return [
    "You are a booking assistant for an Austin, Texas live music platform.",
    "A talent buyer describes a show they are booking. Extract the search criteria only.",
    "",
    "Rules:",
    "- Use only genres from the provided list. If the description names a genre that is not on the list, pick the closest one that is.",
    "- Leave a field out when the description genuinely does not say. Do not guess to fill space.",
    "- minDraw is about how many people the band can bring, not the room's capacity.",
    "- keywords describe sound or vibe only. Never repeat a genre name and never include a city or venue name.",
    "",
    "Show description:",
    description,
  ].join("\n");
}

const GENRE_SET = new Set<string>(GENRES);
const DRAW_SET = new Set<string>(DRAW_ORDER);
// Keywords come back lowercased, so genre exclusion has to compare that way or
// "acoustic" scores twice: once as the Acoustic genre, once as a vibe word.
const GENRE_SET_LOWER = new Set<string>(GENRES.map((g) => g.toLowerCase()));

/**
 * Best-effort extraction. Returns EMPTY_CRITERIA plus a reason when Gemini is
 * unavailable or returns nothing usable, which the caller surfaces as a plain
 * keyword search rather than an error.
 */
export async function extractShowCriteria(description: string): Promise<{
  criteria: ShowCriteria;
  aiUsed: boolean;
  reason?: string;
}> {
  const trimmed = description.trim();
  if (!trimmed) return { criteria: EMPTY_CRITERIA, aiUsed: false };

  const result = await generateJson<Partial<ShowCriteria>>(
    buildPrompt(trimmed),
    SCHEMA,
  );

  if (!result.ok) {
    return { criteria: EMPTY_CRITERIA, aiUsed: false, reason: result.reason };
  }

  return { criteria: sanitize(result.data), aiUsed: true };
}

/**
 * Re-validate everything the model sent. `responseSchema` is a strong hint, not
 * a contract, and a genre that no longer exists would otherwise become a filter
 * that silently matches nobody.
 */
function sanitize(raw: Partial<ShowCriteria>): ShowCriteria {
  const genres = Array.isArray(raw.genres)
    ? Array.from(
        new Set(
          raw.genres.filter(
            (g): g is string => typeof g === "string" && GENRE_SET.has(g),
          ),
        ),
      ).slice(0, 5)
    : [];

  // The smallest bucket is "at least nobody" — every band clears it, so it is
  // not a filter, it is noise that would score points and show a "draws up to
  // 25" chip on bands the buyer never asked about. Models reach for it whenever
  // a description merely sounds small ("quiet brunch"), so drop it here.
  const rawDraw =
    typeof raw.minDraw === "string" && DRAW_SET.has(raw.minDraw)
      ? raw.minDraw
      : null;
  const minDraw = rawDraw === DRAW_ORDER[0] ? null : rawDraw;

  const maxMemberCount =
    typeof raw.maxMemberCount === "number" &&
    Number.isFinite(raw.maxMemberCount) &&
    raw.maxMemberCount > 0
      ? Math.min(Math.round(raw.maxMemberCount), 50)
      : null;

  const keywords = Array.isArray(raw.keywords)
    ? Array.from(
        new Set(
          raw.keywords
            .filter((k): k is string => typeof k === "string")
            .map((k) => k.trim().toLowerCase())
            .filter(
              (k) => k.length > 2 && k.length < 24 && !GENRE_SET_LOWER.has(k),
            ),
        ),
      ).slice(0, 5)
    : [];

  return { genres, minDraw, maxMemberCount, keywords };
}
