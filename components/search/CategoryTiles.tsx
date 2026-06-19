import Link from "next/link";
import type { PlayerType } from "@/lib/types";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";

type FilterValue = PlayerType | "all";

const TILES: { value: PlayerType; label: string }[] = [
  { value: "band", label: "Bands" },
  { value: "venue", label: "Venues" },
  { value: "talent_buyer", label: "Talent Buyers" },
  { value: "record_label", label: "Labels" },
  { value: "festival", label: "Festivals" },
];

type Props = {
  active: FilterValue;
  counts: Record<PlayerType | "all", number>;
};

export function CategoryTiles({ active, counts }: Props) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-gray-400">
          Browse by category
        </h2>
        <Link
          href="/search?type=all"
          scroll={false}
          aria-current={active === "all" ? "page" : undefined}
          className={[
            "text-xs font-semibold transition",
            active === "all"
              ? "text-brand-orange"
              : "text-brand-gray-400 hover:text-white",
          ].join(" ")}
        >
          Show all ({counts.all})
        </Link>
      </div>

      {/* flex-wrap + justify-center keeps every tile the same size and centers
          the lone 5th tile instead of leaving an empty grid hole. gap-3 = 0.75rem:
          2-up → basis calc(50% - 0.375rem); 5-up → basis calc(20% - 0.6rem). */}
      <nav
        aria-label="Browse by player type"
        className="flex flex-wrap justify-center gap-3"
      >
        {TILES.map((t) => {
          const isActive = t.value === active;
          const count = counts[t.value] ?? 0;
          const href =
            t.value === "band" ? "/search" : `/search?type=${t.value}`;

          return (
            <Link
              key={t.value}
              href={href}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={[
                "group flex shrink-0 grow-0 basis-[calc(50%-0.375rem)] flex-col gap-3 rounded-2xl border p-4 transition-all duration-200 lg:basis-[calc(20%-0.6rem)]",
                isActive
                  ? "border-brand-orange bg-brand-orange/10 shadow-lg shadow-brand-orange/10"
                  : "border-white/10 bg-white/5 hover:-translate-y-0.5 hover:border-brand-orange/40 hover:bg-white/10",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-11 w-11 items-center justify-center rounded-xl transition",
                  isActive
                    ? "bg-brand-orange text-black"
                    : "bg-brand-orange/10 text-brand-orange group-hover:bg-brand-orange/20",
                ].join(" ")}
              >
                <PlayerTypeIcon
                  type={t.value}
                  className="h-5 w-5"
                  strokeWidth={2}
                />
              </span>

              <div>
                <p className="text-sm font-bold text-white">{t.label}</p>
                <p className="mt-0.5 text-xs text-brand-gray-400">
                  {count} {count === 1 ? "profile" : "profiles"}
                </p>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
