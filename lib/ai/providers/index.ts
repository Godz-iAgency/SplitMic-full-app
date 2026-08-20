import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import type { ChatRequest, LLMProvider, LLMResult } from "./types";

export type { ChatRequest, LLMProvider, LLMResult } from "./types";
export type {
  ProviderTurn,
  ToolCall,
  ToolDefinition,
  ToolSchema,
  ToolParam,
  LLMReply,
} from "./types";

/**
 * Primary-with-fallback orchestration: Gemini first, Groq if Gemini fails in
 * a way another provider could plausibly survive.
 *
 * The conversation, tools, and system prompt are provider-independent by
 * construction (see ./types.ts), so falling back mid-conversation carries the
 * full context across rather than restarting — the user never sees a seam.
 */

export type ProviderOutcome = {
  result: LLMResult;
  /** Which provider produced `result`. Recorded in ai_usage_events. */
  provider: string;
  model: string;
  /** True when the primary failed and the fallback answered instead. */
  fellBack: boolean;
  /** Primary's failure reason, kept for logging even when the fallback wins. */
  primaryError?: string;
};

/**
 * Attempts each configured provider in order. A provider that isn't
 * configured is skipped silently rather than counted as a failure — a deploy
 * without GROQ_API_KEY should behave exactly like a Gemini-only deploy, not
 * report a fallback error on every request.
 *
 * Only `retryable` failures advance to the next provider. A malformed request
 * or a bad key fails identically everywhere, so retrying it would just burn
 * the fallback's quota to produce the same error twice.
 */
export async function chatWithFallback(
  request: ChatRequest,
  providers: LLMProvider[] = defaultProviders(),
): Promise<ProviderOutcome> {
  const configured = providers.filter((p) => p.isConfigured());

  if (configured.length === 0) {
    return {
      result: {
        ok: false,
        reason: "No AI provider is configured",
        retryable: false,
      },
      provider: "none",
      model: "none",
      fellBack: false,
    };
  }

  let primaryError: string | undefined;

  for (let i = 0; i < configured.length; i++) {
    const provider = configured[i];
    const result = await provider.chat(request);

    if (result.ok) {
      return {
        result,
        provider: provider.name,
        model: provider.model,
        fellBack: i > 0,
        primaryError,
      };
    }

    const isLast = i === configured.length - 1;
    if (!result.retryable || isLast) {
      return {
        result,
        provider: provider.name,
        model: provider.model,
        fellBack: i > 0,
        primaryError,
      };
    }

    // Remember why the primary failed — a fallback that succeeds still needs
    // to leave evidence that the primary is degraded.
    if (i === 0) primaryError = result.reason;
  }

  // Unreachable: the loop always returns on its last iteration.
  return {
    result: { ok: false, reason: "No provider attempted", retryable: false },
    provider: "none",
    model: "none",
    fellBack: false,
  };
}

/** Order is the fallback order. */
export function defaultProviders(): LLMProvider[] {
  return [new GeminiProvider(), new GroqProvider()];
}
