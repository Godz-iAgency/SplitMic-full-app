"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Dropdown } from "@/components/ui/Dropdown";

const SORT_OPTIONS = [
  { value: "newest", label: "Recently updated" },
  { value: "recent", label: "Recently joined" },
];

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
    <Dropdown
      value={currentSort}
      onChange={handleChange}
      options={SORT_OPTIONS}
      ariaLabel="Sort results"
    />
  );
}
