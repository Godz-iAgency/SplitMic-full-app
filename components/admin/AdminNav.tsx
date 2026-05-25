"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Link2,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

const items: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", Icon: Users },
  { href: "/admin/posts", label: "Posts", Icon: FileText },
  { href: "/admin/connections", label: "Connections", Icon: Link2 },
  { href: "/admin/log", label: "Action log", Icon: ScrollText },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/5 bg-white/5 p-2 lg:flex-col lg:overflow-visible lg:p-3">
      {items.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-brand-orange text-black"
                : "text-brand-gray-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <item.Icon
              className="h-4 w-4"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
