import { FAQ_BY_CATEGORY } from "@/lib/directory/faqContent";
import { CATEGORY_META, type DirectoryCategory } from "@/lib/directory/categories";

/**
 * Native <details>/<summary> — no JS, fully crawlable. Renders the same
 * FAQ_BY_CATEGORY entries the FAQPage JSON-LD is built from.
 */
export function DirectoryFaqSection({
  category,
}: {
  category: DirectoryCategory;
}) {
  const items = FAQ_BY_CATEGORY[category];
  if (items.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="text-2xl font-bold text-white">
        {CATEGORY_META[category].seoTitle}: FAQ
      </h2>
      <div className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
        {items.map((item) => (
          <details key={item.question} className="group p-5">
            <summary className="cursor-pointer list-none text-base font-semibold text-white marker:content-none">
              {item.question}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-brand-gray-300">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
