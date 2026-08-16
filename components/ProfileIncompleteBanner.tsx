import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";

/**
 * Shown on the browse surfaces (Home / Discover / Feed) to a signed-up user who
 * hasn't finished onboarding.
 *
 * Reciprocity: those pages deliberately stay open before the profile is done, so
 * the user sees the real scene before being asked to invest. This banner is the
 * "ask" half of that trade, and the only path forward once they want to act, so
 * it has to be present on every page they can reach in that state.
 *
 * Framing is loss-first (you are invisible / can't be found) to match the
 * publish CTA, rather than a neutral "complete your profile" instruction.
 */
export function ProfileIncompleteBanner() {
  return (
    <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
      <div className="flex flex-col gap-3 rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <Eye
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-orange"
            strokeWidth={2}
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-white sm:text-base">
              You can look, but nobody can find you
            </p>
            <p className="mt-0.5 text-xs text-brand-gray-200 sm:text-sm">
              Finish your profile to message venues, respond to gigs, and show
              up in these results yourself.
            </p>
          </div>
        </div>
        <Link
          href="/onboarding"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-black tappable hover:bg-brand-orange/90"
        >
          Finish my profile
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Compact variant for narrow slots (the post-detail sidebar, a profile's
 * Connect position). Stands in for an action the user can't take yet, so they
 * get a reason and a next step instead of a control that errors on submit or a
 * silently missing button.
 */
export function ProfileIncompleteCard({
  action,
  /** Defaults to the onboarding flow. Pass a profile URL for the separate case
   *  of a finished-but-unpublished profile, where publishing is the real gate. */
  href = "/onboarding",
  title,
  body = "You're still mid-signup. It takes about three minutes.",
  cta = "Finish my profile",
}: {
  action: string;
  href?: string;
  title?: string;
  body?: string;
  cta?: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-5">
      <p className="text-sm font-semibold text-white">
        {title ?? `Finish your profile to ${action}`}
      </p>
      <p className="mt-1 text-xs text-brand-gray-200">{body}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-xs font-bold text-black tappable hover:bg-brand-orange/90"
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      </Link>
    </div>
  );
}
