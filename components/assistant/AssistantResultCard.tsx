import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { AssistantCard } from "@/lib/ai/assistant/contract";

/**
 * One assistant result. Every link on this card comes from structured tool
 * output built server-side from a database row — the model's text never
 * carries URLs (see lib/ai/assistant/contract.ts), so nothing here can be a
 * fabricated destination.
 *
 * `source` is always rendered when present. A Do512 listing and a Ticketmaster
 * ticketed show look identical otherwise, and conflating them is exactly the
 * claim the source-transparency rule exists to prevent.
 */
export function AssistantResultCard({ card }: { card: AssistantCard }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {card.imageUrl ? (
        // Fixed height inside a fluid card: checked at ~1000px, where these
        // cards are widest (two columns sharing the container) — see CLAUDE.md
        // on non-monotonic card width.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.imageUrl}
          alt=""
          className="h-28 w-full object-cover md:h-36 lg:h-28"
          loading="lazy"
        />
      ) : null}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-white">
            {card.title}
          </h3>
          {card.source ? (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-brand-gray-400">
              {card.source}
            </span>
          ) : null}
        </div>

        {card.subtitle ? (
          <p className="mt-1 line-clamp-2 text-sm text-brand-gray-300">
            {card.subtitle}
          </p>
        ) : null}

        {card.meta.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {card.meta.map((m) => (
              <li
                key={m}
                className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-brand-gray-300"
              >
                {m}
              </li>
            ))}
          </ul>
        ) : null}

        {card.actions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {card.actions.map((action, i) =>
              action.external ? (
                <a
                  key={action.href}
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={actionClass(i === 0)}
                >
                  {action.label}
                  <ExternalLink className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                </a>
              ) : (
                <Link key={action.href} href={action.href} className={actionClass(i === 0)}>
                  {action.label}
                </Link>
              ),
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * The first action is the primary one. `.tappable` rather than a hand-rolled
 * active: state — the global tap-highlight suppression means a control with
 * only a hover style is silent on the touch devices this PWA is installed on.
 */
function actionClass(primary: boolean): string {
  const base =
    "tappable inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold";
  return primary
    ? `${base} bg-brand-orange text-black`
    : `${base} border border-white/10 bg-white/5 text-white`;
}
