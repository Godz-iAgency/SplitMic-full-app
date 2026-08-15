"use client";

import { useEffect, useState, useRef } from "react";
import { Search } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function MarketplaceSearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";

  const [value, setValue] = useState(initial);
  const lastNavigated = useRef(initial);

  // Debounced URL sync
  useEffect(() => {
    if (value === lastNavigated.current) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      lastNavigated.current = value;
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        strokeWidth={2}
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-orange"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search posts by title…"
        aria-label="Search marketplace posts"
        className="w-full rounded-full border border-white/15 bg-white/5 py-3 pl-11 pr-5 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
      />
    </div>
  );
}
