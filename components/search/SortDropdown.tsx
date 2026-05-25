"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function SortDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") ?? "newest";

  function handleChange(sort: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort && sort !== "newest") {
      params.set("sort", sort);
    } else {
      params.delete("sort");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Sort by</span>
      <select
        value={currentSort}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Sort results"
        className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40 [color-scheme:dark]"
      >
        <option value="newest">Recently updated</option>
        <option value="recent">Recently joined</option>
      </select>
    </label>
  );
}
