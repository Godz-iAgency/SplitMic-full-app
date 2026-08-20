import { describe, it, expect } from "vitest";
import { stripUrls } from "./runAssistant";

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
