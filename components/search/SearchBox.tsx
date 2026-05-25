"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * Debounced search-by-name input. Updates the `q` URL param 300ms after the
 * user stops typing, which causes the server component to re-fetch results.
 */
export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";

  const [value, setValue] = useState(urlQuery);

  // Sync local value if URL changes externally (e.g. user clicks a filter pill)
  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  // Debounce: when local value differs from URL, update URL after 300ms idle
  useEffect(() => {
    if (value === urlQuery) return;

    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(handler);
  }, [value, urlQuery, searchParams, pathname, router]);

  return (
    <div className="relative max-w-xl">
      <Search
        aria-hidden="true"
        strokeWidth={2}
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-orange"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name…"
        aria-label="Search by name"
        className="w-full rounded-full border border-white/15 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
      />
    </div>
  );
}
