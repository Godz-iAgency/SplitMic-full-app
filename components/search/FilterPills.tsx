import Link from "next/link";
import type { PlayerType } from "@/lib/types";

type FilterValue = PlayerType | "all";

const PILLS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "band", label: "Bands" },
  { value: "venue", label: "Venues" },
  { value: "talent_buyer", label: "Talent Buyers" },
  { value: "record_label", label: "Labels" },
  { value: "festival", label: "Festivals" },
];

type Props = {
  active: FilterValue;
};

export function FilterPills({ active }: Props) {
  return (
    <nav
      aria-label="Filter by player type"
      className="-mx-1 flex flex-wrap gap-2"
    >
      {PILLS.map((p) => {
        const isActive = p.value === active;
        const href = p.value === "band" ? "/search" : `/search?type=${p.value}`;
        return (
          <Link
            key={p.value}
            href={href}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={[
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition",
              isActive
                ? "border-brand-orange bg-brand-orange text-black"
                : "border-white/15 bg-white/5 text-white hover:bg-white/10",
            ].join(" ")}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
