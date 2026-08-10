import { FAQ_ITEMS } from "@/lib/events/faqContent";

/**
 * Native <details>/<summary> — zero JS, fully crawlable and accessible.
 * Renders the exact same FAQ_ITEMS array the FAQPage JSON-LD is built from
 * (lib/events/jsonld.ts), so the visible copy and the structured data never
 * drift apart.
 */
export function EventFaqSection() {
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-bold text-white">Austin Live Music FAQ</h2>
      <div className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
        {FAQ_ITEMS.map((item) => (
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
