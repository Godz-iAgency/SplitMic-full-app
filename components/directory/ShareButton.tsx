"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

type Props = {
  businessName: string;
  /** Anchor on the directory page for this listing, e.g. "/directory/venues#b-<id>". */
  path: string;
  className?: string;
};

/**
 * Share a listing. Uses the native share sheet on mobile (where it's the
 * expected gesture and can hand off to Messages/WhatsApp), and falls back to
 * copying the link on desktop, where navigator.share mostly doesn't exist.
 */
export function ShareButton({ businessName, path, className }: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: businessName, url });
        return;
      } catch {
        // User dismissed the sheet, or the browser rejected it — fall through
        // to copying rather than leaving the tap with no effect.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context or denied permission). Nothing
      // useful left to try, and an error toast for a share button is noise.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={`Share ${businessName}`}
      className={
        className ??
        // Taller on mobile for a comfortable tap target, tighter at sm:.
        "tappable inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-2.5 text-xs font-semibold text-white backdrop-blur hover:border-brand-orange/50 hover:text-brand-orange sm:px-2.5 sm:py-1.5"
      }
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Copied
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          Share
        </>
      )}
    </button>
  );
}
