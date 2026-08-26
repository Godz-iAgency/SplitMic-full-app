import Link from "next/link";
import Image from "next/image";
import { Home } from "lucide-react";
import { ThemeSongButton } from "./ThemeSongButton";

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
      {/* `relative` anchors ThemeSongButton's hidden player, which is
          absolutely positioned so it occupies no layout space.

          The row is sized to FIT rather than to scroll: `<body>` carries
          `overflow-x-clip`, which silently slices off anything wider than the
          viewport with no warning, so anything that does not fit simply
          disappears. Confirmed on a real Samsung A16 that the previous sizing
          still overflowed — "Live Music" ran flush to the screen edge and
          Chrome drew its scrollbar as a bright bar under the row, which read
          as a broken underline. The labels drop to 14px below `sm` (see the
          links themselves) to buy that room back.

          `overflow-x-auto` stays purely as a fallback for extreme font
          scaling, now with the scrollbar hidden: at normal settings nothing
          scrolls, and the failure mode if it ever does is "swipe to see the
          rest" rather than "content vanishes." Reverts to `visible` at `sm`,
          where there is abundant room and a scroll container would only risk
          trapping wheel gestures. */}
      <div className="no-scrollbar relative mx-auto flex h-14 max-w-6xl items-center gap-1 overflow-x-auto px-4 sm:gap-3 sm:overflow-visible sm:px-6">
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

        {/* The one control here that isn't navigation, so it stays orange at
            every width rather than following the icon-on-mobile pattern —
            being the odd one out is what makes it noticeable. */}
        <ThemeSongButton />

        {/* Spacer pushes Directory/Live Music to the far right, matching
            where "Log in" used to sit. */}
        <div className="flex-1" />

        {/* Directory, then Live Music — always plain text, every width, no
            icon-only mobile state. These are real routes, so Link for
            client-side navigation. */}
        {/* `text-xs` below `sm` is 14px here, not 12px — this config scales
            the whole type ramp up one step (tailwind.config.ts), so these
            stay comfortably legible while giving back the ~20px that kept
            "Live Music" pinned against the screen edge on a 412px phone. */}
        <nav
          aria-label="Directory and live music"
          className="flex shrink-0 items-center gap-1"
        >
          {RIGHT_TABS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap rounded-full px-2 py-1.5 text-xs font-semibold text-brand-gray-300 tappable hover:bg-white/5 hover:text-white sm:px-3 sm:text-sm"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
