"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Search, Sparkles, Info } from "lucide-react";
import { MatchResultCard } from "./MatchResultCard";
import { findMatchingBands } from "@/app/match/actions";
import {
  DESCRIPTION_MAX,
  type MatchResponse,
} from "@/lib/ai/showMatchContract";

/** One tap fills the box, so nobody stares at an empty textarea wondering
 *  how much detail this thing wants. */
const EXAMPLES = [
  "Thursday night at a 150-cap bar. Looking for a mellow acoustic act that can bring 50 people.",
  "Loud punk bill for a Saturday, three bands, each needs to draw at least 75.",
  "Sunday afternoon patio show. Solo or duo, something laid back, Americana or folk.",
];

const DRAW_LABELS: Record<string, string> = {
  "0-25": "draws up to 25",
  "25-75": "draws 25 to 75",
  "75-200": "draws 75 to 200",
  "200+": "draws 200 or more",
};

export function ShowMatchForm() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setResult(await findMatchingBands(description));
    });
  }

  const understood = result?.understood;
  const chips: string[] = understood
    ? [
        ...understood.genres,
        ...(understood.minDraw ? [DRAW_LABELS[understood.minDraw]] : []),
        ...(understood.maxMemberCount
          ? [
              understood.maxMemberCount === 1
                ? "solo"
                : `up to ${understood.maxMemberCount} members`,
            ]
          : []),
        ...understood.keywords,
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* ── Describe the show ─────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label
          htmlFor="show-description"
          className="block text-sm font-semibold text-white"
        >
          Describe the show you&apos;re booking
        </label>
        <textarea
          id="show-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={DESCRIPTION_MAX}
          placeholder="Night of the week, the room, the vibe you want, how many people the band needs to bring. Plain English is fine."
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example, i) => (
              <button
                key={example}
                type="button"
                onClick={() => setDescription(example)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-brand-gray-300 transition hover:border-brand-orange/40 hover:text-white"
              >
                Example {i + 1}
              </button>
            ))}
          </div>
          <span className="text-xs text-brand-gray-400">
            {description.length}/{DESCRIPTION_MAX}
          </span>
        </div>

        <button
          type="submit"
          disabled={isPending || description.trim().length === 0}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto"
        >
          {isPending ? (
            <>
              <Sparkles
                className="h-4 w-4 animate-spin"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              Reading your show…
            </>
          ) : (
            <>
              <Search className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              Find bands
            </>
          )}
        </button>
      </form>

      {/* ── Results ───────────────────────────────────────────────────── */}
      {result?.error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {result.error}
        </p>
      ) : null}

      {result && !result.error ? (
        <div className="space-y-5">
          {/* What we understood — shown before the results so a wrong read is
              obvious immediately, rather than something to work out from a
              confusing shortlist. */}
          {chips.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-white">
                What we picked up
              </p>
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-brand-orange/30 bg-brand-orange/10 px-3 py-1 text-xs font-semibold text-brand-orange"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {!result.aiUsed ? (
            <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-brand-gray-300">
              <Info
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-gray-400"
                strokeWidth={2}
                aria-hidden="true"
              />
              Smart matching is unavailable right now, so these are Austin&apos;s
              most complete band profiles instead of matches for your show. Try
              again in a minute.
            </p>
          ) : null}

          {result.cards.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
              <p className="text-2xl">🔍</p>
              <h2 className="mt-3 text-lg font-semibold text-white">
                No bands match that yet
              </h2>
              <p className="mt-2 text-sm text-brand-gray-300">
                Try loosening the description, or browse everyone on Discover.
              </p>
              <Link
                href="/search?type=band"
                className="mt-6 inline-flex rounded-full bg-brand-orange px-5 py-2 text-sm font-semibold text-black transition hover:bg-brand-orange/90"
              >
                Browse all bands
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-brand-gray-300">
                {result.cards.length}{" "}
                {result.cards.length === 1 ? "band" : "bands"}, best fit first.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {result.cards.map((card, i) => (
                  <MatchResultCard
                    key={card.profile_id}
                    card={card}
                    rank={i + 1}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
