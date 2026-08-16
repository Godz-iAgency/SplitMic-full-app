"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Music2, Check, X } from "lucide-react";
import {
  signUpForOpenMic,
  cancelOpenMicSignup,
} from "@/app/opportunities/actions";

type Props = {
  postId: string;
  initialSignedUp: boolean;
  /** The band's current position in the running order (1-based), if signed up. */
  position: number | null;
  /** How many bands are already in line (for the not-yet-signed-up framing). */
  queueLength?: number;
};

export function OpenMicSignupButton({
  postId,
  initialSignedUp,
  position,
  queueLength = 0,
}: Props) {
  const router = useRouter();
  const [signedUp, setSignedUp] = useState(initialSignedUp);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSignUp() {
    setError(null);
    startTransition(async () => {
      const { error: serverError } = await signUpForOpenMic(postId);
      if (serverError) {
        setError(serverError);
        return;
      }
      setSignedUp(true);
      router.refresh();
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const { error: serverError } = await cancelOpenMicSignup(postId);
      if (serverError) {
        setError(serverError);
        return;
      }
      setSignedUp(false);
      router.refresh();
    });
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-400/25 bg-gradient-to-br from-purple-500/[.08] via-white/[.03] to-transparent p-5 shadow-md shadow-black/30">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-purple-500/10 blur-2xl"
      />
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300">
          Open mic
        </p>

        {signedUp ? (
          <>
            <p className="mt-3 inline-flex items-center gap-2 text-lg font-bold text-white">
              <Check
                className="h-5 w-5 text-emerald-300"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              You&apos;re signed up
            </p>
            {position ? (
              <p className="mt-1 text-sm text-brand-gray-300">
                You&apos;re{" "}
                <span className="font-bold text-white">#{position}</span> in the
                running order. The venue sets the final order the night of.
              </p>
            ) : (
              <p className="mt-1 text-sm text-brand-gray-300">
                The venue sets the running order the night of.
              </p>
            )}
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white tappable hover:bg-white/10 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              {isPending ? "Withdrawing…" : "Withdraw signup"}
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-brand-gray-300">
              {queueLength > 0 ? (
                <>
                  <span className="font-bold text-white">
                    {queueLength} {queueLength === 1 ? "band is" : "bands are"}{" "}
                    already in line.
                  </span>{" "}
                  Sign up to lock your spot. First come, first served.
                </>
              ) : (
                <>
                  Be first on the running order. First come, first served.
                  The venue finalizes the lineup the night of.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={handleSignUp}
              disabled={isPending}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-purple-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-400 disabled:opacity-50"
            >
              <Music2
                className="h-4 w-4"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              {isPending ? "Signing up…" : "Sign up for this open mic"}
            </button>
          </>
        )}

        {error ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
