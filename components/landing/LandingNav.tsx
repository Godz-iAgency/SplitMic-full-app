import Link from "next/link";
import Image from "next/image";
import { Home, Music, BookOpen } from "lucide-react";

/**
 * Home first, then the two public destinations. Home anchors to the player-type
 * section — the "what is this" answer — rather than the very top, which the
 * logo already covers.
 */
const TABS = [
  { href: "#who-its-for", label: "Home", Icon: Home, external: false },
  { href: "/live", label: "Live Music", Icon: Music, external: true },
  { href: "/directory", label: "Directory", Icon: BookOpen, external: true },
];

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        {/* Logo — plain <a> so it always hard-navigates to / and replays the hero animation */}
        <a
          href="/"
          aria-label="SplitMic: back to top"
          className="flex shrink-0 items-center gap-2"
        >
          <Image
            src="/SplitMic Logo image only.png"
            alt=""
            width={32}
            height={32}
            className="h-7 w-7 object-contain"
            priority
          />
          <span className="hidden text-lg font-black tracking-tight text-brand-orange sm:inline">
            SPLIT<span className="text-white">MIC</span>
          </span>
        </a>

        {/* Section tabs — icons on mobile, text labels on sm+.
            No min-w-0: the tab buttons are shrink-0, so without this the nav
            container could be squeezed narrower than its own content and the
            overflow would visually collide with the auth actions next to it. */}
        <nav
          aria-label="Page sections"
          className="flex flex-1 items-center gap-1"
        >
          {TABS.map(({ href, label, Icon, external }) => {
            const className =
              "flex shrink-0 items-center justify-center rounded-full p-2.5 text-brand-gray-300 transition hover:bg-white/5 hover:text-white sm:gap-1.5 sm:px-3 sm:py-1.5";
            const inner = (
              <>
                {/* Icon — mobile only */}
                <Icon className="h-4 w-4 sm:hidden" aria-hidden="true" />
                {/* Text — sm+ only */}
                <span className="hidden whitespace-nowrap text-sm font-semibold sm:inline">
                  {label}
                </span>
              </>
            );

            // Hash anchors stay plain <a> so they scroll; real routes use Link
            // for client-side navigation.
            return external ? (
              <Link key={href} href={href} aria-label={label} className={className}>
                {inner}
              </Link>
            ) : (
              <a key={href} href={href} aria-label={label} className={className}>
                {inner}
              </a>
            );
          })}
        </nav>

        {/* Auth actions — Sign Up lives in the hero CTA; header keeps just Log in */}
        <div className="flex shrink-0 items-center">
          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-brand-gray-300 transition hover:text-white"
          >
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}
