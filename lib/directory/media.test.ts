import { describe, it, expect } from "vitest";
import { faviconUrl, displayHost, directionsUrl, reviewsUrl } from "./media";

describe("faviconUrl", () => {
  it("derives a favicon from a plain website", () => {
    expect(faviconUrl("https://mohawkaustin.com/")).toBe(
      "https://www.google.com/s2/favicons?domain=mohawkaustin.com&sz=128",
    );
  });

  it("keeps a subdomain, since that's where many of these sites live", () => {
    // Regression guard, same as the importer: stripping or www-prefixing a
    // subdomain would point at a host that doesn't exist.
    expect(faviconUrl("https://amplifiedheat.bandcamp.com/")).toBe(
      "https://www.google.com/s2/favicons?domain=amplifiedheat.bandcamp.com&sz=128",
    );
  });

  it("accepts a bare domain with no protocol", () => {
    expect(faviconUrl("stores.guitarcenter.com/austin")).toContain(
      "domain=stores.guitarcenter.com",
    );
  });

  it("honours a custom size", () => {
    expect(faviconUrl("https://mohawkaustin.com/", 64)).toContain("sz=64");
  });

  it.each([[null], [""], ["   "], ["javascript:alert(1)"], ["not a url"]])(
    "returns null for %j",
    (input) => {
      expect(faviconUrl(input)).toBeNull();
    },
  );
});

describe("displayHost", () => {
  it("strips protocol, www, and path", () => {
    expect(displayHost("https://www.mohawkaustin.com/shows?a=1")).toBe(
      "mohawkaustin.com",
    );
  });

  it("leaves a non-www subdomain intact", () => {
    expect(displayHost("https://amplifiedheat.bandcamp.com/")).toBe(
      "amplifiedheat.bandcamp.com",
    );
  });

  it("falls back to the raw value when it can't be parsed", () => {
    expect(displayHost("not a url")).toBe("not a url");
  });
});

describe("directionsUrl / reviewsUrl", () => {
  it("scopes the search to Austin", () => {
    expect(directionsUrl("Mohawk")).toContain("Mohawk%2C%20Austin%2C%20TX");
  });

  it("escapes characters that would otherwise break the query string", () => {
    // Real fixture: this venue name has both & and a trailing space risk.
    const url = reviewsUrl("The 19th Hole @ Putters & Gutters");
    expect(url).not.toContain("&Putters");
    expect(url).toContain("%26");
    expect(url).toContain("%40");
  });

  it("passes an apostrophe through intact", () => {
    // encodeURIComponent deliberately leaves ' unescaped, and a bare
    // apostrophe is legal in a query string — Maps resolves it fine.
    const url = reviewsUrl("Antone's Nightclub");
    expect(url).toContain("Antone's");
    expect(new URL(url).searchParams.get("query")).toBe(
      "Antone's Nightclub, Austin, TX",
    );
  });

  it("trims stray whitespace from the name", () => {
    expect(directionsUrl("  Mohawk  ")).toBe(directionsUrl("Mohawk"));
  });

  it("produces URLs that parse", () => {
    for (const name of ["Mohawk", "C3 Presents", "Superfónicos", "A & B"]) {
      expect(() => new URL(directionsUrl(name))).not.toThrow();
      expect(() => new URL(reviewsUrl(name))).not.toThrow();
    }
  });
});
