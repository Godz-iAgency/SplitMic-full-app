"use client";

import { GENRES } from "@/lib/genres";
import { MINI_GENRE_MAX, MINI_QUESTIONS } from "@/lib/pendingProfile";
import type { PlayerType } from "@/lib/types";

type Props = {
  playerType: PlayerType;
  genres: string[];
  scale: string;
  /** Takes an updater, not a value, so rapid toggles can't clobber each other
   *  by all deriving from the same stale render. */
  onGenresChange: (update: (prev: string[]) => string[]) => void;
  onScaleChange: (value: string) => void;
};

/**
 * The two-question warm-up shown inside the player-type modal, between the
 * benefits pitch and the signup wall. Both answers are optional: the point is
 * to have built something, not to gate the door.
 */
export function MiniProfileBuilder({
  playerType,
  genres,
  scale,
  onGenresChange,
  onScaleChange,
}: Props) {
  const questions = MINI_QUESTIONS[playerType];
  const atMax = genres.length >= MINI_GENRE_MAX;

  function toggleGenre(genre: string) {
    onGenresChange((prev) => {
      if (prev.includes(genre)) return prev.filter((g) => g !== genre);
      if (prev.length >= MINI_GENRE_MAX) return prev;
      return [...prev, genre];
    });
  }

  return (
    <div className="space-y-6">
      {/* Question 1: genres */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-white sm:text-base">
            {questions.genreLabel}
          </h3>
          <span className="shrink-0 text-xs text-brand-gray-400">
            {genres.length}/{MINI_GENRE_MAX}
          </span>
        </div>
        <div
          role="group"
          aria-label={questions.genreLabel}
          className="flex flex-wrap gap-2"
        >
          {GENRES.map((genre) => {
            const active = genres.includes(genre);
            const disabled = !active && atMax;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                disabled={disabled}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${
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
        <p className="mt-2 text-xs text-brand-gray-400">
          Pick up to {MINI_GENRE_MAX}. You can add more later.
        </p>
      </div>

      {/* Question 2: scale / kind */}
      <div>
        <h3 className="mb-2 text-sm font-bold text-white sm:text-base">
          {questions.scaleLabel}
        </h3>
        <div
          role="group"
          aria-label={questions.scaleLabel}
          className="flex flex-wrap gap-2"
        >
          {questions.scaleOptions.map((option) => {
            const active = scale === option.value;
            return (
              <button
                key={option.value}
                type="button"
                // Tapping the active choice clears it, so a misfire isn't stuck.
                onClick={() => onScaleChange(active ? "" : option.value)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                  active
                    ? "border-brand-orange bg-brand-orange text-white"
                    : "border-white/20 bg-transparent text-brand-gray-300 hover:border-white/50 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-brand-gray-400">
          {questions.scaleHint}
        </p>
      </div>
    </div>
  );
}
