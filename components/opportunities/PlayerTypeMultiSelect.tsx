"use client";

import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";

type Props = {
  selected: PlayerType[];
  onChange: (next: PlayerType[]) => void;
};

export function PlayerTypeMultiSelect({ selected, onChange }: Props) {
  function toggle(t: PlayerType) {
    if (selected.includes(t)) onChange(selected.filter((x) => x !== t));
    else onChange([...selected, t]);
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-white">
        Who can respond?
        <span className="ml-2 text-xs font-normal text-brand-gray-400">
          (leave empty for anyone)
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {PLAYER_TYPE_OPTIONS.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-brand-orange bg-brand-orange text-black"
                  : "border-white/15 bg-white/5 text-white hover:border-brand-orange/40"
              }`}
            >
              <PlayerTypeIcon
                type={opt.value}
                className="h-3.5 w-3.5"
                strokeWidth={2}
              />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
