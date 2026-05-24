"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Props = {
  requestCount: number;
  threadCount: number;
};

export function InboxTabs({ requestCount, threadCount }: Props) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "requests";

  return (
    <div className="flex gap-2 border-b border-white/10">
      <TabLink
        href="/inbox?tab=requests"
        active={tab === "requests"}
        label="Requests"
        badge={requestCount}
      />
      <TabLink
        href="/inbox?tab=conversations"
        active={tab === "conversations"}
        label="Conversations"
        badge={threadCount}
      />
    </div>
  );
}

function TabLink({
  href,
  active,
  label,
  badge,
}: {
  href: string;
  active: boolean;
  label: string;
  badge: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-brand-orange text-white"
          : "border-transparent text-brand-gray-400 hover:text-white"
      }`}
    >
      {label}
      {badge > 0 ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            active
              ? "bg-brand-orange text-black"
              : "bg-white/10 text-brand-gray-200"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
