"use client";

import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";

type Props = {
  selected: PlayerType | null;
  onSelect: (value: PlayerType) => void;
  onNext: () => void;
  saving: boolean;
  error: string | null;
};

export function PlayerTypeStep({ selected, onSelect, onNext, saving, error }: Props) {
  return (
    <div className="animate-fade-in">
      <header className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Who are you?</h1>
        <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
          Pick the role that best describes how you&apos;ll use SplitMic.
        </p>
      </header>

      <div className="space-y-3">
        {PLAYER_TYPE_OPTIONS.map((option) => {
          const isActive = selected === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-brand-orange/50 sm:p-5 ${
                isActive
                  ? "border-brand-orange bg-brand-orange/10"
                  : "border-white/10 bg-brand-gray-900 hover:border-white/30"
              }`}
            >
              <input
                type="radio"
                name="player_type"
                value={option.value}
                checked={isActive}
                onChange={() => onSelect(option.value)}
                className="sr-only"
              />
              <span
                className={`mt-0.5 shrink-0 ${
                  isActive ? "text-brand-orange" : "text-brand-gray-300"
                }`}
                aria-hidden="true"
              >
                <PlayerTypeIcon
                  type={option.value}
                  className="h-7 w-7"
                  strokeWidth={1.75}
                />
              </span>
              <span className="flex-1">
                <span className="block text-base font-semibold sm:text-lg">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-sm text-brand-gray-300">
                  {option.description}
                </span>
              </span>
              <span
                className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  isActive
                    ? "border-brand-orange bg-brand-orange"
                    : "border-white/30"
                }`}
                aria-hidden="true"
              >
                {isActive ? (
                  <span className="h-2 w-2 rounded-full bg-white" />
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!selected || saving}
          className="btn-primary sm:min-w-[160px]"
        >
          {saving ? "Saving…" : "Next"}
        </button>
      </div>
    </div>
  );
}
