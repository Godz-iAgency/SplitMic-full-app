import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Way out of the standalone public pages (/live, /directory).
 *
 * Those pages sit outside the landing page's nav, so without this a visitor
 * who arrived from search has no in-page route back to the rest of the site.
 * Deliberately a link to "/" rather than history.back(), which would dead-end
 * anyone who landed here directly.
 */
export function BackToHomeLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-brand-gray-300 transition hover:border-brand-orange/40 hover:text-brand-orange ${className ?? ""}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to SplitMic
    </Link>
  );
}
