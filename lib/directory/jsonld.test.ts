import { describe, it, expect } from "vitest";
import {
  buildDirectoryItemListJsonLd,
  buildDirectoryBreadcrumbJsonLd,
  buildDirectoryFaqJsonLd,
} from "./jsonld";
import { FAQ_BY_CATEGORY } from "./faqContent";
import { DIRECTORY_CATEGORIES, CATEGORY_META } from "./categories";
import type { DirectoryCard } from "./queries";

const BASE = "https://splitmic.com";

const card = (overrides: Partial<DirectoryCard> = {}): DirectoryCard => ({
  id: "b-1",
  category: "venue",
  businessName: "Mohawk Austin",
  websiteUrl: "https://mohawkaustin.com/",
  phone: null,
  description: null,
  subcategory: "Clubs & Small Venues",
  tier: "standard",
  claimedProfileId: null,
  screenshotUrl: null,
  ...overrides,
});

describe("buildDirectoryItemListJsonLd", () => {
  it("emits one ListItem per card, in order", () => {
    const jsonld = buildDirectoryItemListJsonLd(
      [card({ id: "a", businessName: "A" }), card({ id: "b", businessName: "B" })],
      "venue",
      BASE,
    );
    expect(jsonld["@type"]).toBe("ItemList");
    expect(jsonld.numberOfItems).toBe(2);
    expect(jsonld.itemListElement.map((e) => e.position)).toEqual([1, 2]);
    expect(jsonld.itemListElement.map((e) => e.item.name)).toEqual(["A", "B"]);
  });

  it.each([
    ["venue", "MusicVenue"],
    ["band", "MusicGroup"],
    ["festival", "Event"],
    ["record_label", "Organization"],
    ["backline", "Organization"],
  ] as const)("uses the %s schema type %s", (category, expected) => {
    const jsonld = buildDirectoryItemListJsonLd([card({ category })], category, BASE);
    expect(jsonld.itemListElement[0].item["@type"]).toBe(expected);
  });

  it("uses the business website as the item URL", () => {
    const jsonld = buildDirectoryItemListJsonLd([card()], "venue", BASE);
    expect(jsonld.itemListElement[0].item.url).toBe("https://mohawkaustin.com/");
  });

  it("falls back to the claimed profile when there is no website", () => {
    const jsonld = buildDirectoryItemListJsonLd(
      [card({ websiteUrl: null, claimedProfileId: "p-9" })],
      "venue",
      BASE,
    );
    expect(jsonld.itemListElement[0].item.url).toBe(`${BASE}/profile/p-9`);
  });

  it("falls back to the category page when there is neither", () => {
    const jsonld = buildDirectoryItemListJsonLd(
      [card({ websiteUrl: null })],
      "venue",
      BASE,
    );
    expect(jsonld.itemListElement[0].item.url).toBe(`${BASE}/directory/venues`);
  });

  it("never fabricates address, rating, or price fields", () => {
    // We don't own these businesses and can't verify those claims; publishing
    // them anyway is thin-content markup and a manual-action risk.
    const item = buildDirectoryItemListJsonLd([card()], "venue", BASE)
      .itemListElement[0].item as Record<string, unknown>;
    for (const forbidden of [
      "address",
      "aggregateRating",
      "priceRange",
      "telephone",
      "openingHours",
    ]) {
      expect(item).not.toHaveProperty(forbidden);
    }
  });

  it("handles an empty card list", () => {
    const jsonld = buildDirectoryItemListJsonLd([], "venue", BASE);
    expect(jsonld.itemListElement).toEqual([]);
    expect(jsonld.numberOfItems).toBe(0);
  });
});

describe("buildDirectoryBreadcrumbJsonLd", () => {
  it("builds a two-level trail to the category page", () => {
    const jsonld = buildDirectoryBreadcrumbJsonLd("record_label", BASE);
    expect(jsonld["@type"]).toBe("BreadcrumbList");
    expect(jsonld.itemListElement.map((e) => e.item)).toEqual([
      `${BASE}/directory`,
      `${BASE}/directory/record-labels`,
    ]);
  });
});

describe("buildDirectoryFaqJsonLd", () => {
  it.each(DIRECTORY_CATEGORIES)(
    "matches the visible FAQ copy verbatim for %s",
    (category) => {
      const jsonld = buildDirectoryFaqJsonLd(category);
      const source = FAQ_BY_CATEGORY[category];

      expect(jsonld["@type"]).toBe("FAQPage");
      expect(jsonld.mainEntity).toHaveLength(source.length);
      jsonld.mainEntity.forEach((entry, i) => {
        expect(entry.name).toBe(source[i].question);
        expect(entry.acceptedAnswer.text).toBe(source[i].answer);
      });
    },
  );

  it("has FAQ content for every category", () => {
    for (const category of DIRECTORY_CATEGORIES) {
      expect(FAQ_BY_CATEGORY[category].length).toBeGreaterThan(0);
    }
  });
});

describe("category metadata", () => {
  it("gives every category a unique slug", () => {
    const slugs = DIRECTORY_CATEGORIES.map((c) => CATEGORY_META[c].slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every category a unique CSV label", () => {
    const labels = DIRECTORY_CATEGORIES.map((c) => CATEGORY_META[c].csvLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("covers all 8 categories", () => {
    expect(DIRECTORY_CATEGORIES).toHaveLength(8);
  });
});
