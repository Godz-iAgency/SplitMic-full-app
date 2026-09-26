/**
 * Provider-agnostic chat + tool-calling contract.
 *
 * The assistant's business logic (lib/ai/assistant/*) is written against these
 * types only, never against Gemini's or Groq's wire formats — that's what
 * makes the fallback in ./index.ts a swap rather than a rewrite, and what
 * lets a third provider be added without touching the tool layer.
 *
 * Note this is deliberately NOT a generalization of lib/ai/gemini.ts. That
 * module does one-shot "prompt in, JSON out" structured extraction for the
 * talent-buyer show matcher and has no notion of turns or tools; this one is
 * multi-turn with function calling. They hit the same Gemini endpoint but
 * solve different problems, and collapsing them would complicate both.
 */

export type ToolParam = {
  type: "string" | "number" | "integer" | "boolean" | "array";
  description?: string;
  enum?: string[];
  items?: { type: string };
};

export type ToolSchema = {
  type: "object";
  properties: Record<string, ToolParam>;
  required?: string[];
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: ToolSchema;
};

export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
  /**
   * Opaque provider state that must travel back with this call on the next
   * request. Gemini 3+ attaches a "thought signature" to a tool call and
   * rejects the follow-up turn with a 400 if it's missing. Providers that
   * don't use one (Groq) leave it unset and ignore it.
   */
  providerSignature?: string;
};

/**
 * One entry in the running conversation sent to a provider. Tool calls and
 * their results are part of this history because the model needs to see what
 * it already asked for and got back; only `user` and `assistant` turns are
 * ever accepted from the browser (see lib/ai/assistant/contract.ts).
 */
export type ProviderTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "assistant_tool_calls"; calls: ToolCall[] }
  | { role: "tool_result"; name: string; result: unknown };

export type ChatRequest = {
  system: string;
  turns: ProviderTurn[];
  tools: ToolDefinition[];
};

export type LLMReply =
  | { kind: "text"; text: string }
  | { kind: "tool_calls"; calls: ToolCall[] };

/**
 * Never-throws result, matching the discriminated-union convention every
 * external client in this repo follows (lib/ai/gemini.ts, lib/events/do512.ts,
 * lib/directory/websiteCheck.ts).
 *
 * `retryable` is the whole point of the failure branch: it distinguishes
 * "this provider can't answer, try the other one" (rate limit, timeout, 5xx,
 * and this provider's own key or model being unavailable) from "this request
 * is malformed" (400). Keys and models are per provider, so a Gemini key or
 * model problem says nothing about Groq; ./index.ts falls back only when this
 * is true.
 */
export type LLMResult =
  | { ok: true; reply: LLMReply }
  | { ok: false; reason: string; retryable: boolean };

export interface LLMProvider {
  /** Short stable id recorded in ai_usage_events.provider. */
  readonly name: string;
  readonly model: string;
  /** True when the provider has the credentials it needs to be attempted. */
  isConfigured(): boolean;
  chat(request: ChatRequest): Promise<LLMResult>;
}
