import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "./gemini";
import type { ChatRequest, ProviderTurn } from "./types";

let fetchMock: ReturnType<typeof vi.fn>;

function respondWith(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

function request(turns: ProviderTurn[]): ChatRequest {
  return { system: "s", turns, tools: [] };
}

/** The `contents` array the provider actually put on the wire. */
function sentContents(callIndex = 0): { role: string; parts: Record<string, unknown>[] }[] {
  const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(String(init.body)).contents;
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MODEL", "");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const USER: ProviderTurn = { role: "user", content: "any jazz tonight?" };
const RESULT: ProviderTurn = { role: "tool_result", name: "search_live_events", result: [] };

describe("GeminiProvider thought signatures", () => {
  it("keeps the signature Gemini attaches to a tool call", async () => {
    respondWith(200, {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: { name: "search_live_events", args: { when: "tonight" } },
                thoughtSignature: "SIG-1",
              },
            ],
          },
        },
      ],
    });

    const result = await new GeminiProvider().chat(request([USER]));

    expect(result).toEqual({
      ok: true,
      reply: {
        kind: "tool_calls",
        calls: [
          { name: "search_live_events", args: { when: "tonight" }, providerSignature: "SIG-1" },
        ],
      },
    });
  });

  it("sends Gemini's own signatures back exactly as received", async () => {
    // The regression this guards: Gemini 3+ rejects the follow-up turn with a
    // non-retryable 400 when the signature is dropped, which failed every
    // SplitMic AI question that needed a lookup. Gemini signs only the first
    // call of a parallel batch, so the second must NOT gain one.
    respondWith(200, { candidates: [{ content: { parts: [{ text: "done" }] } }] });

    await new GeminiProvider().chat(
      request([
        USER,
        {
          role: "assistant_tool_calls",
          calls: [
            { name: "search_live_events", args: {}, providerSignature: "SIG-1" },
            { name: "search_austin_directory", args: {} },
          ],
        },
        RESULT,
      ]),
    );

    const modelTurn = sentContents()[1];
    expect(modelTurn.role).toBe("model");
    expect(modelTurn.parts[0].thoughtSignature).toBe("SIG-1");
    expect(modelTurn.parts[1]).not.toHaveProperty("thoughtSignature");
  });

  it("adds Google's placeholder to a tool call another model made", async () => {
    // A mid-conversation fallback leaves Groq-made calls in the history with
    // no signature. Without the placeholder, the next Gemini step is a 400.
    respondWith(200, { candidates: [{ content: { parts: [{ text: "done" }] } }] });

    await new GeminiProvider().chat(
      request([
        USER,
        {
          role: "assistant_tool_calls",
          calls: [
            { name: "search_live_events", args: {} },
            { name: "search_austin_directory", args: {} },
          ],
        },
        RESULT,
      ]),
    );

    const modelTurn = sentContents()[1];
    expect(modelTurn.parts[0].thoughtSignature).toBe("skip_thought_signature_validator");
    expect(modelTurn.parts[1]).not.toHaveProperty("thoughtSignature");
  });
});

describe("GeminiProvider failure classification", () => {
  it.each([401, 403, 404])(
    "falls back on %i, since it's this provider's own key or model",
    async (status) => {
      // The regression this guards: a model Google retired for new keys came
      // back 404, was treated as non-retryable, and took SplitMic AI down while
      // a healthy Groq was never asked.
      respondWith(status, { error: { message: "unavailable" } });
      const result = await new GeminiProvider().chat(request([USER]));
      expect(result).toMatchObject({ ok: false, retryable: true });
    },
  );

  it.each([429, 500, 503])("falls back on %i", async (status) => {
    respondWith(status, { error: { message: "busy" } });
    const result = await new GeminiProvider().chat(request([USER]));
    expect(result).toMatchObject({ ok: false, retryable: true });
  });

  it("does not fall back on 400, a malformed request", async () => {
    respondWith(400, { error: { message: "bad request" } });
    const result = await new GeminiProvider().chat(request([USER]));
    expect(result).toMatchObject({ ok: false, retryable: false });
  });
});
