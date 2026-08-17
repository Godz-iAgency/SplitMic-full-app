"use client";

import type { ReactNode } from "react";
import type { LiveEventCard } from "@/lib/events/queries";
import { buildUberUrl, buildUberAppIntentUrl } from "@/lib/events/getThereLinks";

type Props = {
  event: LiveEventCard;
  className?: string;
  children: ReactNode;
};

/**
 * "Get an Uber" link.
 *
 * Progressive enhancement, deliberately: the rendered `href` is always the
 * plain https link, so this works with no JS, is crawlable, and behaves
 * exactly as before on iOS and desktop. The only thing the click handler
 * changes is Android, where the https App Link was observed opening Chrome
 * instead of the app — see buildUberAppIntentUrl for why an explicit intent
 * is the one thing that can force the handoff there.
 *
 * Navigating the current tab rather than opening a new one is intentional
 * for the intent path: on success the Uber app takes over and the page is
 * left untouched behind it, so a `_blank` tab would just be orphaned.
 */
export function UberLink({ event, className, children }: Props) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!/Android/i.test(navigator.userAgent)) return;
    e.preventDefault();
    // Chrome falls back to S.browser_fallback_url (the same https link this
    // anchor already points at) when the Uber app isn't installed.
    window.location.href = buildUberAppIntentUrl(event);
  }

  return (
    <a
      href={buildUberUrl(event)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
