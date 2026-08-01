"use client";

import { Check, Loader2, Sparkles } from "lucide-react";

/** The 4 real save stages in OnboardingFlow's handleProfileSubmit, in order.
 *  Shared here so the checklist labels and the actual step count driving
 *  `completedSteps` can never drift out of sync with each other. */
export const CREATING_ACCOUNT_STEPS = [
  "Saving your profile",
  "Saving your details",
  "Saving your links",
  "Publishing your page",
];

type Props = {
  /** How many of CREATING_ACCOUNT_STEPS have actually finished, 0-4. */
  completedSteps: number;
};

export function CreatingAccountOverlay({ completedSteps }: Props) {
  const total = CREATING_ACCOUNT_STEPS.length;
  const percent = Math.min(100, (completedSteps / total) * 100);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-gradient-to-b from-black/95 via-brand-gray-900/95 to-black/95 px-6 backdrop-blur-md"
    >
      <div className="w-full max-w-sm animate-slide-up rounded-2xl border border-brand-orange/20 bg-brand-gray-900 p-8 text-center shadow-2xl shadow-brand-orange/10">
        {/* Glowing badge: a pulsing halo behind a spinning sparkle */}
        <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center">
          <span
            className="absolute inset-0 animate-glow-pulse rounded-full bg-brand-orange/40 blur-xl"
            aria-hidden="true"
          />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-brand-orange/40 bg-black/60">
            <Sparkles
              className="h-7 w-7 animate-spin text-brand-orange"
              style={{ animationDuration: "2.5s" }}
              strokeWidth={2}
              aria-hidden="true"
            />
          </span>
        </div>

        <p className="text-lg font-bold text-white sm:text-xl">
          Creating account
        </p>

        <ul className="mt-5 space-y-2.5 text-left">
          {CREATING_ACCOUNT_STEPS.map((label, i) => {
            const done = i < completedSteps;
            const active = i === completedSteps;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    done
                      ? "border-brand-orange bg-brand-orange"
                      : "border-white/20 bg-transparent"
                  }`}
                  aria-hidden="true"
                >
                  {done ? (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin text-brand-orange" />
                  ) : null}
                </span>
                <span
                  className={`text-sm transition-colors ${
                    done
                      ? "text-white"
                      : active
                        ? "text-brand-gray-200"
                        : "text-brand-gray-400"
                  }`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-6 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-orange-dark via-brand-orange to-brand-orange-light transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          >
            <div className="h-full w-full animate-bar-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
