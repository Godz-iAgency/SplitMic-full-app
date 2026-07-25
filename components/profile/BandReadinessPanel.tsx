"use client";

import { useState } from "react";
import { Zap, Lock, ChevronDown, Check } from "lucide-react";
import type { BandReadiness } from "@/lib/scoring/bandReadiness";

type Props = {
  readiness: BandReadiness;
};

/**
 * Owner-only, PRIVATE Band Readiness breakdown. Shows the score (the same number
 * talent buyers see publicly) and, when expanded, exactly how each criterion was
 * scored plus what to change to reach 10. The band is told clearly that buyers
 * only ever see the number, never this breakdown. All values come pre-computed
 * from lib/scoring/bandReadiness.ts — no logic lives here.
 */
export function BandReadinessPanel({ readiness }: Props) {
  const [open, setOpen] = useState(false);
  const { score, max, criteria } = readiness;
  const pct = Math.round((score / max) * 100);

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-brand-orange/30 bg-gradient-to-br from-brand-orange/[.08] via-white/[.03] to-transparent shadow-lg shadow-black/30">
      {/* Header — click to expand */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-white/[.03]"
      >
        {/* Score dial */}
        <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-brand-orange/40 bg-black/40">
          <Zap
            className="absolute h-4 w-4 -translate-y-5 text-brand-orange"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          <span className="text-2xl font-black text-white">
            {score.toFixed(1)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white sm:text-lg">
              Band Readiness Score
            </h2>
            <span className="text-sm font-semibold text-brand-gray-400">
              {score.toFixed(1)} / {max}
            </span>
          </div>
          {/* Overall bar */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-orange to-orange-400 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-gray-400">
            <Lock
              className="h-3.5 w-3.5 flex-shrink-0 text-brand-orange"
              strokeWidth={2}
              aria-hidden="true"
            />
            Private to you: tap to see why, and how to reach {max}.
          </p>
        </div>

        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-brand-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {/* Breakdown */}
      {open ? (
        <div className="border-t border-white/10 p-5">
          <ul className="flex flex-col gap-5">
            {criteria.map((c) => {
              const maxed = c.points >= c.max;
              const barPct = Math.round((c.points / c.max) * 100);
              return (
                <li key={c.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      {maxed ? (
                        <Check
                          className="h-3.5 w-3.5 text-brand-orange"
                          strokeWidth={3}
                          aria-hidden="true"
                        />
                      ) : null}
                      {c.label}
                    </p>
                    <span className="flex-shrink-0 text-xs font-bold text-brand-gray-300">
                      {c.points} / {c.max} pts
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        maxed ? "bg-brand-orange" : "bg-brand-orange/60"
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-brand-gray-300">{c.detail}</p>
                  {c.advice ? (
                    <p className="mt-1 text-xs font-medium text-brand-orange">
                      → {c.advice}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="mt-5 rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-brand-gray-400">
            <Lock
              className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-brand-orange"
              strokeWidth={2}
              aria-hidden="true"
            />
            Talent buyers and venues only see your score (
            <span className="font-bold text-brand-orange">
              {score.toFixed(1)}
            </span>
            ) on your card, never this breakdown. Update your numbers anytime in{" "}
            <span className="font-semibold text-brand-gray-200">
              Edit Profile
            </span>
            .
          </p>
        </div>
      ) : null}
    </section>
  );
}
