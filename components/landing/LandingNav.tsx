import Link from "next/link";
import Image from "next/image";

/**
 * Sticky top navigation for the landing page. Lets visitors jump straight to a
 * section instead of scrolling, and keeps Log in / Get Early Access always
 * reachable. Pure anchor links — no JS required. The tab row scrolls
 * horizontally on small screens so every tab stays reachable on mobile.
 */
const TABS = [
  { href: "#home", label: "Home" },
  { href: "#who-its-for", label: "Who it's for" },
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
];

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        {/* Logo → back to top */}
        <Link
          href="#home"
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
        </Link>

        {/* Section tabs — horizontally scrollable on mobile */}
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-brand-gray-300 transition hover:bg-white/5 hover:text-white"
            >
              {tab.label}
            </a>
          ))}
        </nav>

        {/* Auth actions — always visible */}
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
            <span className="hidden sm:inline">Get Early Access</span>
            <span className="sm:hidden">Sign up</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
