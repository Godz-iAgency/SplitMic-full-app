"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Dropdown } from "@/components/ui/Dropdown";

const ALL = "all";

type Props = {
  /** Distinct values present in this category, from getSubcategoryOptions. */
  options: string[];
  /** e.g. "All venue types" — what a subcategory means differs per category. */
  allLabel: string;
  ariaLabel: string;
};

/**
 * Filters the listing by subcategory via a `?sub=` param.
 *
 * URL-driven rather than local state so a filtered view is linkable and
 * survives a reload — and so the clickable subcategory tags on the cards can
 * drive the same filter just by being links.
 */
export function DirectorySubcategoryFilter({
  options,
  allLabel,
  ariaLabel,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (options.length === 0) return null;

  const current = searchParams.get("sub") ?? ALL;

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    // Same convention as SortDropdown: the default value stays out of the URL.
    if (next && next !== ALL) params.set("sub", next);
    else params.delete("sub");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Dropdown
      value={current}
      onChange={handleChange}
      ariaLabel={ariaLabel}
      options={[
        { value: ALL, label: allLabel },
        ...options.map((value) => ({ value, label: value })),
      ]}
    />
  );
}
