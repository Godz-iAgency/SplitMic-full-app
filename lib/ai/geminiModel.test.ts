import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GEMINI_MODEL,
  geminiModel,
  minimalThinkingConfig,
} from "./geminiModel";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("geminiModel", () => {
  it("defaults to gemini-3.5-flash-lite", () => {
    vi.stubEnv("GEMINI_MODEL", "");
    expect(geminiModel()).toBe("gemini-3.5-flash-lite");
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.5-flash-lite");
  });

  it("honors a GEMINI_MODEL override, trimmed", () => {
    vi.stubEnv("GEMINI_MODEL", "  gemini-3.8-flash  ");
    expect(geminiModel()).toBe("gemini-3.8-flash");
  });

  it("treats a whitespace-only override as unset", () => {
    vi.stubEnv("GEMINI_MODEL", "   ");
    expect(geminiModel()).toBe(DEFAULT_GEMINI_MODEL);
  });
});

describe("minimalThinkingConfig", () => {
  it("uses a thinking level for Gemini 3+", () => {
    // The regression this guards: Gemini 3.5 rejects thinkingBudget with a
    // 400, and the show matcher swallows failures by design, so sending the
    // 2.x form silently turned AI matching off.
    expect(minimalThinkingConfig("gemini-3.5-flash-lite")).toEqual({
      thinkingLevel: "minimal",
    });
    expect(minimalThinkingConfig("gemini-3.8-flash")).toEqual({
      thinkingLevel: "minimal",
    });
  });

  it("keeps the token budget for Gemini 2.x", () => {
    expect(minimalThinkingConfig("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
  });

  it("compares versions as numbers, not strings", () => {
    // "10" < "3" as strings; a two-digit major must still count as newer.
    expect(minimalThinkingConfig("gemini-10-flash")).toEqual({
      thinkingLevel: "minimal",
    });
  });

  it("treats an unversioned alias as the current generation", () => {
    expect(minimalThinkingConfig("gemini-flash-latest")).toEqual({
      thinkingLevel: "minimal",
    });
  });
});
