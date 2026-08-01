import Link from "next/link";
import {
  Home,
  Compass,
  Newspaper,
  UserCircle,
  LifeBuoy,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { InboxBell } from "@/components/inbox/InboxBell";
import { AdminLink } from "@/components/admin/AdminLink";
import { HeaderMessagesLink } from "@/components/HeaderMessagesLink";

type Active = "home" | "discover" | "feed" | "inbox" | "profile" | null;

type Props = {
  /** Which destination is currently active (for nav highlight). */
  active?: Active;
  /** The viewer's own profile id — powers the "My profile" link + bottom tab. */
  profileId?: string | null;
  /** Show the desktop "Edit" shortcut (used on the Discover page). */
  showEdit?: boolean;
};

const DESKTOP_NAV: { key: Active; href: string; label: string }[] = [
  { key: "home", href: "/home", label: "Home" },
  { key: "discover", href: "/search", label: "Discover" },
  { key: "feed", href: "/opportunities", label: "Feed" },
];

/**
 * Shared top header for all authenticated pages. Designed to NEVER overflow on
 * phones OR tablets: below `lg` (1024px) it collapses to Logo + Bell + Logout,
 * and the primary destinations move to a fixed bottom nav. The `lg` cutoff is
 * deliberate — portrait tablets like the Galaxy Tab A7 report an 800px CSS
 * width, which is above `md` (768px), so they'd otherwise get the crowded
 * desktop pill header. On `lg`+ it shows the full pill nav and action cluster.
 * Replaces the previously-duplicated per-page headers.
 */
export function AppHeader({
  active = null,
  profileId = null,
  showEdit = false,
}: Props) {
  const profileHref = profileId ? `/profile/${profileId}` : "/profile/edit";

  return (
    <>
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 shadow-sm shadow-black/40 lg:px-8 lg:py-4">
        {/* Left: logo → Home */}
        <Link
          href="/home"
          aria-label="SplitMic home"
          className="flex min-w-0 shrink items-center"
        >
          <Logo className="text-base lg:text-2xl" />
        </Link>

        {/* Center nav — desktop only */}
        <nav className="hidden items-center gap-1 lg:flex">
          {DESKTOP_NAV.map((item) => {
            const isActive = active === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-orange/30"
                    : "rounded-full px-4 py-2 text-sm font-semibold text-brand-gray-400 transition hover:text-white"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-2 lg:gap-3">
          <span className="hidden lg:inline-flex">
            <AdminLink />
          </span>
          {/* Messages shortcut — mobile/tablet only. Goes straight to your
              conversations so you don't have to open the notifications bell
              first. (Edit + Logout now live on the profile page on mobile.)
              Becomes a dashboard shortcut for admin accounts — see
              HeaderMessagesLink for why. */}
          <HeaderMessagesLink />
          <InboxBell />
          <Link
            href="/support"
            aria-label="Help & Support"
            title="Help & Support"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-brand-gray-400 transition hover:bg-white/5 hover:text-white lg:flex"
          >
            <LifeBuoy className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </Link>
          {profileId ? (
            <Link
              href={profileHref}
              className="hidden rounded-full border border-brand-orange/50 px-4 py-2 text-sm font-semibold text-brand-orange transition hover:bg-brand-orange hover:text-white lg:block"
            >
              My profile
            </Link>
          ) : null}
          {showEdit ? (
            <Link
              href="/profile/edit"
              className="hidden rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 lg:block"
            >
              Edit
            </Link>
          ) : null}
          {/* Logout — desktop only now; on mobile it lives on the profile page
              to prevent accidental sign-outs from the header. */}
          <span className="hidden lg:inline-flex">
            <LogoutButton />
          </span>
        </div>
      </header>

      {/* Mobile + tablet bottom nav — primary destinations, hidden at lg+ */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-white/10 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <BottomTab href="/home" label="Home" icon={Home} active={active === "home"} />
        <BottomTab
          href="/search"
          label="Discover"
          icon={Compass}
          active={active === "discover"}
        />
        <BottomTab
          href="/opportunities"
          label="Feed"
          icon={Newspaper}
          active={active === "feed"}
        />
        <BottomTab
          href={profileHref}
          label="Profile"
          icon={UserCircle}
          active={active === "profile"}
        />
      </nav>
    </>
  );
}

function BottomTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
        active ? "text-brand-orange" : "text-brand-gray-400 hover:text-white"
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
      {label}
    </Link>
  );
}
