import { describe, it, expect } from "vitest";
import { formatPhone, formatThousands, parseDigitsToNumber } from "./format";

describe("formatPhone", () => {
  it("formats a 10-digit US number", () => {
    expect(formatPhone("5703372439")).toBe("(570) 337-2439");
  });

  it("keeps a leading 1 as a country-code prefix", () => {
    expect(formatPhone("15703372439")).toBe("1 (570) 337-2439");
  });

  it("strips whatever punctuation the user typed", () => {
    expect(formatPhone("(570) 337-2439")).toBe("(570) 337-2439");
    expect(formatPhone("570.337.2439")).toBe("(570) 337-2439");
    expect(formatPhone("570-337-2439")).toBe("(570) 337-2439");
  });

  it("is idempotent, so re-formatting on every keystroke is safe", () => {
    const once = formatPhone("5703372439");
    expect(formatPhone(once)).toBe(once);
  });

  it("formats partial input as far as it can, for typing", () => {
    expect(formatPhone("5")).toBe("(5");
    expect(formatPhone("570")).toBe("(570) ");
    expect(formatPhone("570337")).toBe("(570) 337-");
    expect(formatPhone("5703372")).toBe("(570) 337-2");
  });

  it("ignores digits past a full number", () => {
    expect(formatPhone("57033724391234")).toBe("(570) 337-2439");
  });

  it("returns empty for input with no digits", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("abc")).toBe("");
    expect(formatPhone("()- ")).toBe("");
  });
});

describe("formatThousands", () => {
  it("groups with separators", () => {
    expect(formatThousands(52221122)).toBe("52,221,122");
    expect(formatThousands(1000)).toBe("1,000");
  });

  it("leaves short numbers alone", () => {
    expect(formatThousands(0)).toBe("0");
    expect(formatThousands(999)).toBe("999");
  });

  it("renders an unset field as empty, not as 0", () => {
    expect(formatThousands("")).toBe("");
  });
});

describe("parseDigitsToNumber", () => {
  it("parses a grouped string back to a number", () => {
    expect(parseDigitsToNumber("52,221,122")).toBe(52221122);
  });

  it("round-trips with formatThousands", () => {
    expect(parseDigitsToNumber(formatThousands(52221122))).toBe(52221122);
  });

  it("returns empty for input with no digits", () => {
    expect(parseDigitsToNumber("")).toBe("");
    expect(parseDigitsToNumber("abc")).toBe("");
  });

  it("keeps only the digits from mixed input", () => {
    expect(parseDigitsToNumber("1a2b3c")).toBe(123);
  });
});
