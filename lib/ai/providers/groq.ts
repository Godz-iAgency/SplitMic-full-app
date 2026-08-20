import type {
  ChatRequest,
  LLMProvider,
  LLMResult,
  ProviderTurn,
  ToolCall,
} from "./types";

/**
 * Groq provider — the fallback. Groq exposes an OpenAI-compatible
 * chat/completions endpoint, so the wire format here is entirely different
 * from Gemini's: a flat `messages` array with a dedicated "tool" role, and
 * tool results linked back to their call by `tool_call_id` rather than by
 * position. Normalizing that difference is exactly what ./types.ts exists for.
 */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Verified against this account's own /v1/models list and exercised through a
 * full two-step tool round trip (call → result → answer) before being chosen —
 * Groq's catalog varies per account, and the obvious guess (a Llama chat
 * model) returned 404 model_not_found here. Override with GROQ_MODEL if the
 * catalog changes again.
 */
const DEFAULT_MODEL = "openai/gpt-oss-120b";

const TIMEOUT_MS = 20_000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * OpenAI-format tool results must reference the id of the call they answer.
 * Our ProviderTurn carries no ids (Gemini matches on function name instead),
 * so ids are synthesized deterministically from the call's position in the
 * conversation. Consistency within a single request is all that's required,
 * and rebuilding the whole array on every request guarantees it.
 */
function synthesizeCallId(turnIndex: number, callIndex: number): string {
  return `call_${turnIndex}_${callIndex}`;
}

type GroqMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | {
      role: "assistant";
      content: null;
      tool_calls: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export class GroqProvider implements LLMProvider {
  readonly name = "groq";
  readonly model: string;

  constructor(model: string = process.env.GROQ_MODEL || DEFAULT_MODEL) {
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(process.env.GROQ_API_KEY);
  }

  async chat(request: ChatRequest): Promise<LLMResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return { ok: false, reason: "GROQ_API_KEY is not set", retryable: false };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: toGroqMessages(request.system, request.turns),
          tools: request.tools.map((t) => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          })),
          temperature: 0.3,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          reason: `Groq returned ${response.status}`,
          retryable: isRetryableStatus(response.status),
        };
      }

      const body = await response.json();
      return parseGroqReply(body);
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      return {
        ok: false,
        reason: timedOut ? "Groq timed out" : "Could not reach Groq",
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function toGroqMessages(system: string, turns: ProviderTurn[]): GroqMessage[] {
  const messages: GroqMessage[] = [{ role: "system", content: system }];

  // Tracks the id assigned to each pending call so the matching tool_result
  // turn can reference it. Cleared as results are consumed, in order.
  let pendingIds: string[] = [];

  turns.forEach((turn, turnIndex) => {
    switch (turn.role) {
      case "user":
        messages.push({ role: "user", content: turn.content });
        break;
      case "assistant":
        messages.push({ role: "assistant", content: turn.content });
        break;
      case "assistant_tool_calls": {
        pendingIds = turn.calls.map((_, i) => synthesizeCallId(turnIndex, i));
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: turn.calls.map((c, i) => ({
            id: pendingIds[i],
            type: "function" as const,
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          })),
        });
        break;
      }
      case "tool_result": {
        // Results arrive in the same order the calls were made, so the first
        // unconsumed id is this result's. Falling back to a name-derived id
        // keeps the request well-formed even if that invariant ever breaks.
        const id = pendingIds.shift() ?? `call_${turnIndex}_${turn.name}`;
        messages.push({
          role: "tool",
          tool_call_id: id,
          content: JSON.stringify(turn.result),
        });
        break;
      }
    }
  });

  return messages;
}

function parseGroqReply(body: unknown): LLMResult {
  const message = extractMessage(body);
  if (!message) {
    return { ok: false, reason: "Groq returned no content", retryable: true };
  }

  const rawCalls = (message as { tool_calls?: unknown }).tool_calls;
  if (Array.isArray(rawCalls) && rawCalls.length > 0) {
    const calls: ToolCall[] = [];
    for (const raw of rawCalls) {
      const fn = (raw as { function?: unknown }).function;
      if (typeof fn !== "object" || fn === null) continue;
      const name = (fn as { name?: unknown }).name;
      if (typeof name !== "string") continue;
      calls.push({ name, args: parseArguments((fn as { arguments?: unknown }).arguments) });
    }
    if (calls.length > 0) return { ok: true, reply: { kind: "tool_calls", calls } };
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content === "string" && content.trim()) {
    return { ok: true, reply: { kind: "text", text: content.trim() } };
  }

  return { ok: false, reason: "Groq returned an empty reply", retryable: true };
}

/** Arguments arrive as a JSON *string*, and a model can emit invalid JSON. */
function parseArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function extractMessage(body: unknown): unknown | null {
  if (typeof body !== "object" || body === null) return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown }).message;
  return typeof message === "object" && message !== null ? message : null;
}
