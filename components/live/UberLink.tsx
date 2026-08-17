"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { LiveEventCard } from "@/lib/events/queries";
import { buildUberUrl, buildUberAppIntentUrl } from "@/lib/events/getThereLinks";

type Props = {
  event: LiveEventCard;
  className?: string;
  children: ReactNode;
};

/**
 * "Get an Uber" link. The two mobile platforms need opposite handling, which
 * is the whole reason this is a component rather than a plain <a>.
 *
 * **Android** ignores App Link verification if you hand Chrome an explicit
 * `intent://…;package=…`, so the click is intercepted and redirected there
 * (see buildUberAppIntentUrl). Android is happy to open an app from a
 * JS-initiated navigation.
 *
 * **iOS is the exact opposite and must NOT be intercepted:** Universal Links
 * only fire for a genuine user tap on an anchor. Setting `window.location`
 * from JS is explicitly not a user tap, so "helping" iOS the way we help
 * Android would guarantee it never opens the app. All we can do for iOS is
 * make the tap as plain as possible — which also means dropping
 * `target="_blank"`, since opening a new tab is a known way to lose the
 * Universal Link handoff.
 *
 * Desktop keeps `target="_blank"` so clicking doesn't navigate away from the
 * feed. `_blank` is the SSR default and is only removed after mount on iOS,
 * so the server and first client render agree (no hydration mismatch).
 */
export function UberLink({ event, className, children }: Props) {
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    // iPadOS 13+ reports a desktop Mac UA, so it's identified by the touch
    // points a real Mac doesn't have.
    const iOSLike =
      /iPhone|iPad|iPod/i.test(ua) ||
      (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    setIsIos(iOSLike);
  }, []);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Android only — see the docstring for why iOS is deliberately untouched.
    if (!/Android/i.test(navigator.userAgent)) return;
    e.preventDefault();
    // Chrome falls back to S.browser_fallback_url (the same https link this
    // anchor already points at) when the Uber app isn't installed.
    window.location.href = buildUberAppIntentUrl(event);
  }

  return (
    <a
      href={buildUberUrl(event)}
      {...(isIos ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
