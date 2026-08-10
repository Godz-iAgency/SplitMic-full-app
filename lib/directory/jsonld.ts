import { CATEGORY_META, type DirectoryCategory } from "./categories";
import { FAQ_BY_CATEGORY } from "./faqContent";
import type { DirectoryCard } from "./queries";

/**
 * Pure JSON-LD builders for the directory pages — no React, no fetch, so the
 * shape is directly testable.
 *
 * Deliberately emits ItemList rather than a LocalBusiness per row. We don't
 * own these 584 businesses and can't verify addresses, hours, or ratings;
 * publishing rich LocalBusiness markup we can't stand behind is thin-content
 * markup and a manual-action risk. ItemList is the honest schema for a
 * directory of links.
 */

/** schema.org type that best fits each category. */
function itemTypeFor(category: DirectoryCategory): string {
  if (category === "venue") return "MusicVenue";
  if (category === "band") return "MusicGroup";
  if (category === "festival") return "Event";
  return "Organization";
}

export function buildDirectoryItemListJsonLd(
  cards: DirectoryCard[],
  category: DirectoryCategory,
  baseUrl: string,
) {
  const meta = CATEGORY_META[category];
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: meta.seoTitle,
    description: meta.blurb,
    numberOfItems: cards.length,
    itemListElement: cards.map((card, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": itemTypeFor(card.category),
        name: card.businessName,
        url:
          card.websiteUrl ??
          (card.claimedProfileId
            ? `${baseUrl}/profile/${card.claimedProfileId}`
            : `${baseUrl}/directory/${meta.slug}`),
        ...(card.description ? { description: card.description } : {}),
      },
    })),
  };
}

export function buildDirectoryBreadcrumbJsonLd(
  category: DirectoryCategory,
  baseUrl: string,
) {
  const meta = CATEGORY_META[category];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Directory",
        item: `${baseUrl}/directory`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: meta.plural,
        item: `${baseUrl}/directory/${meta.slug}`,
      },
    ],
  };
}

/**
 * Built from the same FAQ_BY_CATEGORY array the visible <details> render from,
 * so the markup and the page copy can never drift apart.
 */
export function buildDirectoryFaqJsonLd(category: DirectoryCategory) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_BY_CATEGORY[category].map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
