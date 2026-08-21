import Link from "next/link";
import Image from "next/image";
import { Home } from "lucide-react";

/**
 * Home anchors to the player-type section — the "what is this" answer —
 * rather than the very top, which the logo already covers. Icon-only on
 * mobile, text label at sm+; unchanged from before.
 */
const HOME_TAB = { href: "#who-its-for", label: "Home" };

/**
 * Directory and Live Music sit on the right, in the header's former "Log in"
 * slot. There is no login entry point in the header at all anymore — Sign Up
 * Free / Log In are already prominent buttons in the hero, so the header's
 * copy was purely redundant, and removing it is what frees the room for these
 * two to read as text at every width instead of icon-only on mobile.
 */
const RIGHT_TABS = [
  { href: "/directory", label: "Directory" },
  { href: "/live", label: "Live Music" },
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

        {/* Home — stays right next to the logo, icon on mobile / text on sm+. */}
        <a
          href={HOME_TAB.href}
          aria-label={HOME_TAB.label}
          className="flex shrink-0 items-center justify-center rounded-full p-2.5 text-brand-gray-300 tappable hover:bg-white/5 hover:text-white sm:gap-1.5 sm:px-3 sm:py-1.5"
        >
          <Home className="h-4 w-4 sm:hidden" aria-hidden="true" />
          <span className="hidden whitespace-nowrap text-sm font-semibold sm:inline">
            {HOME_TAB.label}
          </span>
        </a>

        {/* Spacer pushes Directory/Live Music to the far right, matching
            where "Log in" used to sit. */}
        <div className="flex-1" />

        {/* Directory, then Live Music — always plain text, every width, no
            icon-only mobile state. These are real routes, so Link for
            client-side navigation. */}
        <nav aria-label="Directory and live music" className="flex shrink-0 items-center gap-1">
          {RIGHT_TABS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-brand-gray-300 tappable hover:bg-white/5 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
