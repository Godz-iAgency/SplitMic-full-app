import { describe, it, expect } from "vitest";
import { chatWithFallback } from "./index";
import type { ChatRequest, LLMProvider, LLMResult } from "./types";

const REQUEST: ChatRequest = { system: "s", turns: [], tools: [] };

function provider(
  name: string,
  result: LLMResult,
  configured = true,
): LLMProvider & { calls: number } {
  return {
    name,
    model: `${name}-model`,
    calls: 0,
    isConfigured: () => configured,
    async chat() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      (this as unknown as { calls: number }).calls++;
      return result;
    },
  };
}

const OK: LLMResult = { ok: true, reply: { kind: "text", text: "hi" } };
const RETRYABLE: LLMResult = { ok: false, reason: "429", retryable: true };
const FATAL: LLMResult = { ok: false, reason: "bad key", retryable: false };

describe("chatWithFallback", () => {
  it("uses the primary and never touches the fallback when the primary works", () => {
    const primary = provider("gemini", OK);
    const fallback = provider("groq", OK);

    return chatWithFallback(REQUEST, [primary, fallback]).then((outcome) => {
      expect(outcome.provider).toBe("gemini");
      expect(outcome.fellBack).toBe(false);
      expect(fallback.calls).toBe(0);
    });
  });

  it("falls back on a retryable failure and reports which provider answered", async () => {
    const primary = provider("gemini", RETRYABLE);
    const fallback = provider("groq", OK);

    const outcome = await chatWithFallback(REQUEST, [primary, fallback]);

    expect(outcome.result.ok).toBe(true);
    expect(outcome.provider).toBe("groq");
    expect(outcome.fellBack).toBe(true);
    // The primary's failure is preserved even though the request succeeded —
    // otherwise a degraded primary is invisible from the logs.
    expect(outcome.primaryError).toBe("429");
  });

  it("does NOT fall back on a non-retryable failure", async () => {
    // The regression this guards: a bad request or bad key fails identically
    // everywhere, so retrying just burns the fallback's quota to produce the
    // same error twice.
    const primary = provider("gemini", FATAL);
    const fallback = provider("groq", OK);

    const outcome = await chatWithFallback(REQUEST, [primary, fallback]);

    expect(outcome.result.ok).toBe(false);
    expect(outcome.provider).toBe("gemini");
    expect(fallback.calls).toBe(0);
  });

  it("skips unconfigured providers instead of counting them as failures", async () => {
    // A deploy with no GROQ_API_KEY must behave exactly like a Gemini-only
    // deploy — not report a fallback on every request.
    const primary = provider("gemini", OK);
    const fallback = provider("groq", OK, false);

    const outcome = await chatWithFallback(REQUEST, [primary, fallback]);

    expect(outcome.provider).toBe("gemini");
    expect(outcome.fellBack).toBe(false);
  });

  it("surfaces the last failure when every provider fails", async () => {
    const primary = provider("gemini", RETRYABLE);
    const fallback = provider("groq", { ok: false, reason: "503", retryable: true });

    const outcome = await chatWithFallback(REQUEST, [primary, fallback]);

    expect(outcome.result).toEqual({ ok: false, reason: "503", retryable: true });
    expect(outcome.provider).toBe("groq");
    expect(outcome.fellBack).toBe(true);
  });

  it("reports a clear error when nothing is configured at all", async () => {
    const outcome = await chatWithFallback(REQUEST, [
      provider("gemini", OK, false),
      provider("groq", OK, false),
    ]);

    expect(outcome.result.ok).toBe(false);
    expect(outcome.provider).toBe("none");
  });
});
