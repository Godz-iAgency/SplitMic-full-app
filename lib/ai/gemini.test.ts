import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateJson } from "./gemini";

const SCHEMA = {
  type: "object" as const,
  properties: { genres: { type: "array" as const, items: { type: "string" as const } } },
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MODEL", "");
  fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"genres":["Rock"]}' }] } }],
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function sentRequest(): { url: string; body: Record<string, unknown> } {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, body: JSON.parse(String(init.body)) };
}

describe("generateJson (show matcher)", () => {
  it("calls the shared default model, not a hardcoded one", async () => {
    await generateJson("find a rock band", SCHEMA);
    expect(sentRequest().url).toContain("/models/gemini-3.5-flash-lite:generateContent");
  });

  it("honors GEMINI_MODEL like the assistant does", async () => {
    // Previously only the assistant read GEMINI_MODEL; the matcher ignored it.
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
    await generateJson("find a rock band", SCHEMA);
    expect(sentRequest().url).toContain("/models/gemini-3.8-flash:generateContent");
  });

  it("sends the thinking config the current model accepts", async () => {
    // thinkingBudget is a 400 on Gemini 3+, which this function would turn
    // into a silent fallback to non-AI ranking on every match.
    await generateJson("find a rock band", SCHEMA);
    const config = sentRequest().body.generationConfig as Record<string, unknown>;
    expect(config.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
  });

  it("parses the JSON reply", async () => {
    const result = await generateJson<{ genres: string[] }>("find a rock band", SCHEMA);
    expect(result).toEqual({ ok: true, data: { genres: ["Rock"] } });
  });
});
