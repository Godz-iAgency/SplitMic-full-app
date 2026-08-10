import {
  buildDirectoryItemListJsonLd,
  buildDirectoryBreadcrumbJsonLd,
  buildDirectoryFaqJsonLd,
} from "@/lib/directory/jsonld";
import type { DirectoryCategory } from "@/lib/directory/categories";
import type { DirectoryCard } from "@/lib/directory/queries";

/**
 * Escaping `<` is mandatory here, not defensive: every name and description in
 * this markup is scraped third-party text, and a literal "</script>" inside it
 * would otherwise break out of the tag.
 */
function toScriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function JsonLdScript({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toScriptSafeJson(data) }}
    />
  );
}

export function DirectoryCategoryJsonLd({
  cards,
  category,
  baseUrl,
}: {
  cards: DirectoryCard[];
  category: DirectoryCategory;
  baseUrl: string;
}) {
  return (
    <>
      {cards.length > 0 ? (
        <JsonLdScript data={buildDirectoryItemListJsonLd(cards, category, baseUrl)} />
      ) : null}
      <JsonLdScript data={buildDirectoryBreadcrumbJsonLd(category, baseUrl)} />
      <JsonLdScript data={buildDirectoryFaqJsonLd(category)} />
    </>
  );
}
