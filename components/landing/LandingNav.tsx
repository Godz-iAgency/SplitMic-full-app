import Link from "next/link";
import Image from "next/image";
import { Home, Zap, HelpCircle } from "lucide-react";

const TABS = [
  { href: "#who-its-for", label: "Home", Icon: Home },
  { href: "#features", label: "Features", Icon: Zap },
  { href: "#how-it-works", label: "How it works", Icon: HelpCircle },
];

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        {/* Logo — plain <a> so it always hard-navigates to / and replays the hero animation */}
        <a
          href="/"
          aria-label="SplitMic — back to top"
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

        {/* Section tabs — icons on mobile, text labels on sm+ */}
        <nav
          aria-label="Page sections"
          className="flex min-w-0 flex-1 items-center gap-1"
        >
          {TABS.map(({ href, label, Icon }) => (
            <a
              key={href}
              href={href}
              aria-label={label}
              className="flex shrink-0 items-center justify-center rounded-full p-2.5 text-brand-gray-300 transition hover:bg-white/5 hover:text-white sm:gap-1.5 sm:px-3 sm:py-1.5"
            >
              {/* Icon — mobile only */}
              <Icon className="h-4 w-4 sm:hidden" aria-hidden="true" />
              {/* Text — sm+ only */}
              <span className="hidden whitespace-nowrap text-sm font-semibold sm:inline">
                {label}
              </span>
            </a>
          ))}
        </nav>

        {/* Auth actions */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-brand-gray-300 transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-brand-orange px-3 py-1.5 text-sm font-bold text-white shadow-sm shadow-brand-orange/30 transition hover:bg-orange-600 sm:px-4"
          >
            <span className="hidden sm:inline">Sign Up Free</span>
            <span className="sm:hidden">Sign up</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
