"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mic, Briefcase, LayoutGrid, type LucideIcon } from "lucide-react";

const FILTERS: Array<{ value: string; label: string; Icon: LucideIcon }> = [
  { value: "all", label: "All posts", Icon: LayoutGrid },
  { value: "event", label: "Events", Icon: Mic },
  { value: "opportunity", label: "Opportunities", Icon: Briefcase },
];

export function PostTypeFilter({ active }: { active: string }) {
  const searchParams = useSearchParams();

  function buildHref(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("type");
    else params.set("type", value);
    const qs = params.toString();
    return qs ? `/opportunities?${qs}` : "/opportunities";
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const isActive = active === f.value;
        return (
          <Link
            key={f.value}
            href={buildHref(f.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "border-brand-orange bg-brand-orange text-black"
                : "border-white/15 bg-white/5 text-white hover:border-brand-orange/40 hover:bg-white/10"
            }`}
          >
            <f.Icon
              className="h-3.5 w-3.5"
              strokeWidth={2.25}
              aria-hidden="true"
            />
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
