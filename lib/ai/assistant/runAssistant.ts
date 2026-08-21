import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerType } from "@/lib/types";
import { chatWithFallback, type ProviderTurn } from "@/lib/ai/providers";
import { buildSystemPrompt } from "./systemPrompt";
import { TOOL_DEFINITIONS, runTool, type ToolContext } from "./tools";
import {
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_LENGTH,
  type AssistantCard,
  type AssistantResponse,
  type AssistantTurn,
} from "./contract";

/**
 * The assistant's reason → search → answer loop.
 *
 * Bounded on purpose: the model may call tools, see the results, and call
 * again, but only so many times. An unbounded loop is how a tool-calling agent
 * turns one user message into an open-ended sequence of database queries and a
 * request that never returns.
 */

/**
 * Enough for "search → look at results → answer", plus one extra round for a
 * follow-up search (e.g. no members found, try the directory). A fourth round
 * has not once been the difference between a good and bad answer in testing,
 * and every round is a full model call against the 60s function ceiling.
 */
const MAX_STEPS = 3;

export type AssistantRunResult = AssistantResponse & {
  /** Telemetry for ai_usage_events. Not shown to the user. */
  telemetry: {
    provider: string;
    model: string;
    fellBack: boolean;
    toolCalls: number;
    resultCount: number;
    error?: string;
  };
};

export async function runAssistant(options: {
  supabase: SupabaseClient;
  viewerPlayerType: PlayerType | null;
  history: AssistantTurn[];
  message: string;
  now?: Date;
}): Promise<AssistantRunResult> {
  const now = options.now ?? new Date();
  const system = buildSystemPrompt(options.viewerPlayerType, now);

  const toolCtx: ToolContext = {
    supabase: options.supabase,
    viewerPlayerType: options.viewerPlayerType,
    now,
  };

  const turns: ProviderTurn[] = [
    ...sanitizeHistory(options.history),
    { role: "user", content: options.message.slice(0, MAX_MESSAGE_LENGTH) },
  ];

  const cards: AssistantCard[] = [];
  let toolCallCount = 0;
  let provider = "none";
  let model = "none";
  let fellBack = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    const outcome = await chatWithFallback({
      system,
      turns,
      tools: TOOL_DEFINITIONS,
    });

    provider = outcome.provider;
    model = outcome.model;
    fellBack = outcome.fellBack || fellBack;

    if (outcome.primaryError) {
      console.error("[assistant] primary provider failed:", outcome.primaryError);
    }

    if (!outcome.result.ok) {
      return {
        text: "",
        cards,
        error: friendlyError(outcome.result.reason),
        telemetry: {
          provider,
          model,
          fellBack,
          toolCalls: toolCallCount,
          resultCount: cards.length,
          error: outcome.result.reason,
        },
      };
    }

    const reply = outcome.result.reply;

    if (reply.kind === "text") {
      return {
        text: cleanModelText(reply.text),
        cards: dedupeCards(cards),
        degraded: fellBack,
        telemetry: {
          provider,
          model,
          fellBack,
          toolCalls: toolCallCount,
          resultCount: cards.length,
        },
      };
    }

    // Tool calls — run them all, then let the model see the results.
    turns.push({ role: "assistant_tool_calls", calls: reply.calls });

    for (const call of reply.calls) {
      toolCallCount++;
      const outcomeForCall = await runTool(call, toolCtx);
      cards.push(...outcomeForCall.cards);
      turns.push({
        role: "tool_result",
        name: call.name,
        result: outcomeForCall.summary,
      });
    }
  }

  // Step budget spent without the model settling on a text answer. The cards
  // it gathered are real, so show them rather than discarding the work —
  // silence here would look identical to "nothing found", which is worse.
  return {
    text:
      cards.length > 0
        ? "Here's what I found."
        : "I wasn't able to narrow that down. Could you give me a bit more detail?",
    cards: dedupeCards(cards),
    degraded: fellBack,
    telemetry: {
      provider,
      model,
      fellBack,
      toolCalls: toolCallCount,
      resultCount: cards.length,
    },
  };
}

/**
 * Only plain user/assistant text crosses from the browser, capped in both
 * count and length. Tool calls and tool results are never accepted from the
 * client: a forged tool result would let a caller feed invented "search
 * results" into the model's context and have them narrated back as fact.
 */
function sanitizeHistory(history: AssistantTurn[]): ProviderTurn[] {
  return history
    .filter(
      (t) =>
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string" &&
        t.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({
      role: t.role,
      content: t.content.slice(0, MAX_MESSAGE_LENGTH),
    }));
}

/**
 * Both cleanups here are defense in depth, not the primary defense. The
 * system prompt already forbids links and em dashes, and tool results contain
 * no URLs for the model to copy, but a model can still ignore an instruction.
 * Enforcing it in code, not just requesting it in the prompt, is what makes it
 * a guarantee.
 */
function cleanModelText(text: string): string {
  return stripEmDashes(stripUrls(text));
}

/**
 * A fabricated link that 404s (or worse, resolves somewhere unrelated) is
 * exactly the failure the no-URL rule exists to prevent.
 */
export function stripUrls(text: string): string {
  return text
    // [label](https://…) → label. The link text is usually a real record name.
    .replace(/\[([^\]]*)\]\((?:https?:\/\/|www\.|\/)[^)]*\)/gi, "$1")
    // Bare URLs, with any trailing sentence punctuation left in place.
    .replace(/\b(?:https?:\/\/|www\.)[^\s<>()]+/gi, "")
    // Collapse the whitespace the removals leave behind.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,!?;:])/g, "$1")
    .trim();
}

/**
 * Em dashes read as an unmistakable "written by a language model" tell to
 * most people at this point, which defeats the point of a tool meant to feel
 * like a normal part of the product rather than a bolted-on chatbot. The
 * common LLM pattern is a spaced em dash joining two clauses, which reads
 * naturally as a comma; a rarer unspaced one (a date or number range) reads
 * naturally as a hyphen instead.
 */
export function stripEmDashes(text: string): string {
  return text
    .replace(/\s+—\s+/g, ", ")
    .replace(/—/g, "-")
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,!?;:])/g, "$1")
    .trim();
}

/** The same record can surface from two tool calls in one turn. */
function dedupeCards(cards: AssistantCard[]): AssistantCard[] {
  const seen = new Set<string>();
  const out: AssistantCard[] = [];
  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    out.push(card);
  }
  return out;
}

/** Provider reasons are diagnostic strings; users get something actionable. */
function friendlyError(reason: string): string {
  if (reason.includes("not configured") || reason.includes("is not set")) {
    return "SplitMic AI isn't configured yet. Please try again later.";
  }
  return "SplitMic AI is having trouble right now. Please try again in a moment.";
}
