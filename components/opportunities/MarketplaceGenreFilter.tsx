"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Dropdown } from "@/components/ui/Dropdown";
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

  const options = [
    { value: "", label: "All genres" },
    ...GENRES.map((g) => ({ value: g, label: g })),
  ];

  return (
    <Dropdown
      value={currentGenre}
      onChange={handleChange}
      options={options}
      ariaLabel="Filter by genre"
    />
  );
}
