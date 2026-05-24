"use client";

import { GENRES } from "@/lib/genres";

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
  label?: string;
};

export function GenreMultiSelect({
  selected,
  onChange,
  label = "Genres",
}: Props) {
  function toggle(g: string) {
    if (selected.includes(g)) onChange(selected.filter((x) => x !== g));
    else onChange([...selected, g]);
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-white">
        {label}
        <span className="ml-2 text-xs font-normal text-brand-gray-400">
          ({selected.length} selected)
        </span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {GENRES.map((g) => {
          const active = selected.includes(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggle(g)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-brand-orange bg-brand-orange text-black"
                  : "border-white/15 bg-white/5 text-brand-gray-200 hover:border-brand-orange/40 hover:text-white"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>
    </div>
  );
}
