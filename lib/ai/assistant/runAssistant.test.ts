import { describe, it, expect } from "vitest";
import { stripUrls, stripEmDashes } from "./runAssistant";

/**
 * stripUrls is the enforcement half of the no-fabricated-URL rule. The system
 * prompt asks the model not to write links and tool results give it none to
 * copy, but neither is a guarantee — this is, so it's worth testing directly.
 */
describe("stripUrls", () => {
  it("keeps ordinary prose untouched", () => {
    const text = "I found 3 bands that play reggae in Austin.";
    expect(stripUrls(text)).toBe(text);
  });

  it("unwraps a markdown link to its label", () => {
    expect(stripUrls("See [Mohawk Austin](https://mohawkaustin.com) tonight.")).toBe(
      "See Mohawk Austin tonight.",
    );
  });

  it("unwraps a markdown link pointing at an internal route", () => {
    expect(stripUrls("Open [their profile](/profile/abc-123) to message them.")).toBe(
      "Open their profile to message them.",
    );
  });

  it("removes a bare url but keeps the sentence readable", () => {
    // The regression this guards: a model inventing a plausible-looking
    // ticket link. A wrong URL that resolves somewhere unrelated is worse
    // than no link, and the card below the message carries the real one.
    expect(stripUrls("Get tickets at https://ticketmaster.com/event/12345 now.")).toBe(
      "Get tickets at now.",
    );
  });

  it("removes a www-style url with no scheme", () => {
    expect(stripUrls("Their site is www.example.com and it works.")).toBe(
      "Their site is and it works.",
    );
  });

  it("does not leave a space before trailing punctuation", () => {
    expect(stripUrls("Details: https://example.com/a/b.")).toBe("Details:");
  });

  it("handles several links in one message", () => {
    expect(
      stripUrls("[A](https://a.com) and [B](https://b.com) both play tonight."),
    ).toBe("A and B both play tonight.");
  });

  it("leaves an empty string when the text was only a link", () => {
    expect(stripUrls("https://example.com")).toBe("");
  });
});

/**
 * stripEmDashes is the enforcement half of the "never use an em dash" rule in
 * systemPrompt.ts. Both Gemini and Groq reach for a spaced em dash constantly
 * in freeform prose (observed live during testing), and it's one of the more
 * recognizable "this was written by a model" tells, which undercuts the whole
 * point of an assistant meant to feel like a normal part of the product.
 * Asking the model not to is not a guarantee, so this backstop is.
 */
describe("stripEmDashes", () => {
  it("keeps ordinary prose untouched", () => {
    const text = "I found 3 bands that play reggae in Austin.";
    expect(stripEmDashes(text)).toBe(text);
  });

  it("replaces a spaced em dash joining two clauses with a comma", () => {
    expect(
      stripEmDashes("I found 12 shows tonight — three are ticketed through Ticketmaster."),
    ).toBe("I found 12 shows tonight, three are ticketed through Ticketmaster.");
  });

  it("replaces an unspaced em dash (a range) with a hyphen", () => {
    expect(stripEmDashes("The festival runs Aug 20—Aug 22.")).toBe(
      "The festival runs Aug 20-Aug 22.",
    );
  });

  it("handles several em dashes in one message", () => {
    expect(
      stripEmDashes("Rock — Country — Blues are all represented tonight."),
    ).toBe("Rock, Country, Blues are all represented tonight.");
  });

  it("does not leave a space before trailing punctuation", () => {
    expect(stripEmDashes("Doors at 8pm — early by local standards.")).toBe(
      "Doors at 8pm, early by local standards.",
    );
  });
});
