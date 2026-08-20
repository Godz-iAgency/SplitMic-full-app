import type {
  ChatRequest,
  LLMProvider,
  LLMResult,
  ProviderTurn,
  ToolCall,
} from "./types";

/**
 * Gemini provider — the primary. Plain `fetch` against the REST API, matching
 * the established pattern for every external service in this repo (no SDK for
 * what is a single documented endpoint).
 *
 * Schema note: `parameters` is sent with lowercase JSON-Schema type names
 * ("object", "string"). That's the same shape lib/ai/gemini.ts already sends
 * as `responseSchema` in production against the same API version, so it's a
 * verified-working form rather than an assumption.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Longer than lib/ai/gemini.ts's 12s because this call can carry a full
 * conversation plus tool results, and because a slow answer here still
 * produces a useful reply — unlike the show matcher, where a slow match is
 * worse than falling back to plain search. Still well under the 60s Vercel
 * function ceiling even across the assistant's multi-step tool loop.
 */
const TIMEOUT_MS = 20_000;

/**
 * Status codes worth trying the other provider for. 429 is quota/rate limit
 * and 5xx is provider-side failure — both mean "ask someone else". A 400 or
 * 403 means our request or key is wrong, which Groq would reject identically,
 * so those are non-retryable and surface as-is.
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  readonly model: string;

  constructor(model: string = process.env.GEMINI_MODEL || DEFAULT_MODEL) {
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async chat(request: ChatRequest): Promise<LLMResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { ok: false, reason: "GEMINI_API_KEY is not set", retryable: false };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(
        `${ENDPOINT}/${this.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.system }] },
            contents: toGeminiContents(request.turns),
            tools: [
              {
                functionDeclarations: request.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                })),
              },
            ],
            generationConfig: {
              // Low but not zero: the assistant writes short prose around
              // structured results, and temperature 0 makes that read
              // robotically identical every turn.
              temperature: 0.3,
              maxOutputTokens: 800,
            },
          }),
        },
      );

      if (!response.ok) {
        return {
          ok: false,
          reason: `Gemini returned ${response.status}`,
          retryable: isRetryableStatus(response.status),
        };
      }

      const body = await response.json();
      return parseGeminiReply(body);
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      return {
        ok: false,
        reason: timedOut ? "Gemini timed out" : "Could not reach Gemini",
        // Both are transient by nature — exactly the case the fallback exists for.
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args?: Record<string, unknown> } }
  | { functionResponse: { name: string; response: unknown } };

/**
 * Gemini has exactly two content roles: "user" and "model". Tool *results* are
 * sent back under the "user" role (they're input to the model, not output from
 * it) while the tool *calls* stay under "model" — that asymmetry is the part
 * worth knowing when reading this mapping.
 */
function toGeminiContents(
  turns: ProviderTurn[],
): { role: "user" | "model"; parts: GeminiPart[] }[] {
  return turns.map((turn) => {
    switch (turn.role) {
      case "user":
        return { role: "user" as const, parts: [{ text: turn.content }] };
      case "assistant":
        return { role: "model" as const, parts: [{ text: turn.content }] };
      case "assistant_tool_calls":
        return {
          role: "model" as const,
          parts: turn.calls.map((c) => ({
            functionCall: { name: c.name, args: c.args },
          })),
        };
      case "tool_result":
        return {
          role: "user" as const,
          parts: [
            {
              functionResponse: {
                name: turn.name,
                // Gemini requires the response be a JSON object, not a bare
                // array or scalar, so tool output is always wrapped.
                response: { result: turn.result },
              },
            },
          ],
        };
    }
  });
}

function parseGeminiReply(body: unknown): LLMResult {
  const parts = extractParts(body);
  if (!parts) {
    return { ok: false, reason: "Gemini returned no content", retryable: true };
  }

  const calls: ToolCall[] = [];
  const texts: string[] = [];

  for (const part of parts) {
    if (isFunctionCallPart(part)) {
      calls.push({
        name: part.functionCall.name,
        args: part.functionCall.args ?? {},
      });
    } else if (isTextPart(part) && part.text.trim()) {
      texts.push(part.text);
    }
  }

  // A reply can legitimately carry both prose and a tool call. Tool calls take
  // priority: the prose is preamble ("let me look that up") and the real answer
  // only exists after the tool runs.
  if (calls.length > 0) return { ok: true, reply: { kind: "tool_calls", calls } };
  if (texts.length > 0) {
    return { ok: true, reply: { kind: "text", text: texts.join("\n").trim() } };
  }

  return { ok: false, reason: "Gemini returned an empty reply", retryable: true };
}

function extractParts(body: unknown): unknown[] | null {
  if (typeof body !== "object" || body === null) return null;
  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const content = (candidates[0] as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return null;
  const parts = (content as { parts?: unknown }).parts;
  return Array.isArray(parts) ? parts : null;
}

function isTextPart(part: unknown): part is { text: string } {
  return (
    typeof part === "object" &&
    part !== null &&
    typeof (part as { text?: unknown }).text === "string"
  );
}

function isFunctionCallPart(
  part: unknown,
): part is { functionCall: { name: string; args?: Record<string, unknown> } } {
  if (typeof part !== "object" || part === null) return false;
  const fc = (part as { functionCall?: unknown }).functionCall;
  return (
    typeof fc === "object" &&
    fc !== null &&
    typeof (fc as { name?: unknown }).name === "string"
  );
}
