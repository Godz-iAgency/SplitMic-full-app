"use client";

import { GENRES } from "@/lib/genres";

type Props = {
  id: string;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  required?: boolean;
  max?: number;
};

export function GenreMultiSelect({
  id,
  label,
  value,
  onChange,
  required,
  max = 6,
}: Props) {
  function toggle(genre: string) {
    if (value.includes(genre)) {
      onChange(value.filter((g) => g !== genre));
    } else if (value.length < max) {
      onChange([...value, genre]);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="label-text mb-0">
          {label}
          {required ? <span className="ml-1 text-brand-orange">*</span> : null}
        </label>
        <span className="text-xs text-brand-gray-400">
          {value.length}/{max} selected
        </span>
      </div>
      <div
        id={id}
        role="group"
        aria-label={label}
        className="flex flex-wrap gap-2 rounded-lg border border-white/15 bg-brand-gray-900 p-3"
      >
        {GENRES.map((genre) => {
          const active = value.includes(genre);
          const disabled = !active && value.length >= max;
          return (
            <button
              key={genre}
              type="button"
              onClick={() => toggle(genre)}
              disabled={disabled}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "border-brand-orange bg-brand-orange text-white"
                  : "border-white/20 bg-transparent text-brand-gray-300 hover:border-white/50 hover:text-white"
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-brand-gray-400">
        Pick up to {max}. Tap again to deselect.
      </p>
    </div>
  );
}
