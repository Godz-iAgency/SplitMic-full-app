/**
 * Thin Gemini client. Server-only — import this from server actions and server
 * components only. The key is read from `GEMINI_API_KEY` (no `NEXT_PUBLIC_`
 * prefix), which Next never inlines into a client bundle, so it cannot leak
 * even if something imports this by mistake.
 *
 * Deliberately plain `fetch` against the REST API instead of the Google SDK.
 * The only call we make is "one prompt in, one JSON object out" — a dependency
 * would add install weight and a version to track for no gain.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Cheap + fast, and this is a structured-extraction job, not a reasoning one. */
const MODEL = "gemini-2.5-flash";

/** A slow match is worse than no match: the caller falls back to plain search. */
const TIMEOUT_MS = 12_000;

/** Subset of JSON Schema that Gemini's responseSchema accepts. */
export type GeminiSchema = {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  description?: string;
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
  enum?: string[];
  nullable?: boolean;
};

export type GeminiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

/**
 * Sends one prompt and parses the reply as JSON matching `schema`.
 *
 * Never throws: every failure path (missing key, network, timeout, non-200,
 * unparseable body) comes back as `{ ok: false }` so callers can degrade to a
 * non-AI path rather than showing an error page.
 */
export async function generateJson<T>(
  prompt: string,
  schema: GeminiSchema,
): Promise<GeminiResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reason: "GEMINI_API_KEY is not set" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${ENDPOINT}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
            // Extraction, not creative writing — we want the same description
            // to produce the same filters every time.
            temperature: 0,
            // Thinking adds seconds of latency for no accuracy gain on a task
            // this mechanical.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!response.ok) {
      return { ok: false, reason: `Gemini returned ${response.status}` };
    }

    const body = await response.json();
    const text: unknown =
      body?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    if (typeof text !== "string") {
      return { ok: false, reason: "Gemini returned no text" };
    }

    return { ok: true, data: JSON.parse(text) as T };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "Gemini timed out"
        : "Could not reach Gemini";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}
