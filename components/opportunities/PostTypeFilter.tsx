"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const FILTERS = [
  { value: "all", label: "All posts" },
  { value: "event", label: "🎤 Events" },
  { value: "opportunity", label: "📋 Opportunities" },
] as const;

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
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "border-brand-orange bg-brand-orange text-black"
                : "border-white/15 bg-white/5 text-white hover:border-brand-orange/40 hover:bg-white/10"
            }`}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
