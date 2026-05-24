"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { GENRES } from "@/lib/genres";

export function MarketplaceGenreFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentGenre = searchParams.get("genre") ?? "";

  function handleChange(genre: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (genre) params.set("genre", genre);
    else params.delete("genre");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Genre</span>
      <select
        value={currentGenre}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Filter by genre"
        className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
      >
        <option value="">All genres</option>
        {GENRES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    </label>
  );
}
