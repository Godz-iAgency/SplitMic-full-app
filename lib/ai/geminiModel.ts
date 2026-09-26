/**
 * The one place the Gemini model is chosen. Both Gemini callers, the show
 * matcher (lib/ai/gemini.ts) and SplitMic AI (lib/ai/providers/gemini.ts),
 * read it from here. They used to hardcode gemini-2.5-flash separately, and
 * only one of them honored GEMINI_MODEL, so when Google retired that model for
 * new keys both broke at once and only one could have been rescued by config.
 *
 * gemini-3.5-flash-lite: the newest Flash-Lite text model on this account's
 * /v1beta/models list, verified end to end for both the structured-extraction
 * and multi-step tool-calling paths. Flash-Lite is Google's tier with the most
 * generous request quota, which matters more here than peak reasoning: the
 * work is tool selection and short prose, not deep analysis.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export type MinimalThinkingConfig =
  | { thinkingBudget: 0 }
  | { thinkingLevel: "minimal" };

/**
 * "Think as little as possible", in the form the model accepts. Gemini 2.x
 * takes a token budget; Gemini 3+ takes a level and rejects the budget with a
 * 400 (verified live against gemini-3.5-flash-lite). Sending the wrong one is
 * not a no-op, it's a failed request, and the show matcher swallows failures
 * by design, so the mismatch would have silently disabled AI matching.
 */
export function minimalThinkingConfig(model: string): MinimalThinkingConfig {
  const major = /^gemini-(\d+)/.exec(model)?.[1];
  // Unversioned aliases (gemini-flash-latest) track the current generation,
  // which uses levels.
  return major !== undefined && Number(major) < 3
    ? { thinkingBudget: 0 }
    : { thinkingLevel: "minimal" };
}
