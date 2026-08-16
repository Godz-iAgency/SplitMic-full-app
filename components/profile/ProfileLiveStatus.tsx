"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { publishProfile, unpublishProfile } from "@/app/profile/[id]/actions";

type Props = {
  profileId: string;
};

/**
 * Shown to the owner once their profile is published.
 * The Update button re-runs the publish action (idempotent on the server side)
 * so users have a clear "push my latest changes live" affordance.
 * The Unpublish button hides the profile from search with a confirmation step.
 */
export function ProfileLiveStatus({ profileId }: Props) {
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);

  // Auto-clear the success label so the button returns to "Update"
  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(() => setShowSuccess(false), 2500);
    return () => clearTimeout(t);
  }, [showSuccess]);

  async function handleUpdate() {
    setBusy(true);
    setError(null);
    setShowSuccess(false);
    try {
      const result = await publishProfile(profileId);
      if (!result.ok) {
        setError(result.error ?? "Could not update.");
        return;
      }
      setShowSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpublish() {
    setBusy(true);
    setError(null);
    try {
      const result = await unpublishProfile(profileId);
      if (!result.ok) {
        setError(result.error ?? "Could not unpublish.");
        return;
      }
      // On success the server calls revalidatePath → page re-renders with is_published false
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      setConfirmingUnpublish(false);
    }
  }

  return (
    <div className="mt-12 rounded-2xl border border-brand-orange/40 bg-gradient-to-br from-brand-orange/[.08] via-white/[.03] to-transparent p-5 shadow-lg shadow-black/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {/* Pulsing live dot */}
          <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-orange opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-orange" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-brand-orange">
              Your profile is live
            </p>
            <p className="mt-0.5 text-xs text-brand-gray-400">
              Austin can find you in search. After editing anything, hit
              Update to push the changes.
            </p>
            {error ? (
              <p className="mt-2 text-xs font-medium text-red-400">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleUpdate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-orange/50 bg-brand-orange/15 px-5 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-sm shadow-brand-orange/20 transition hover:bg-brand-orange hover:shadow-md hover:shadow-brand-orange/40 disabled:opacity-50"
          >
            {busy && !confirmingUnpublish ? (
              "Updating…"
            ) : showSuccess ? (
              <>
                Updated
                <Check
                  className="h-4 w-4"
                  strokeWidth={3}
                  aria-hidden="true"
                />
              </>
            ) : (
              "Update"
            )}
          </button>
        </div>
      </div>

      {/* ── Unpublish section ─────────────────────────────────────────── */}
      <div className="mt-5 border-t border-white/5 pt-4">
        {confirmingUnpublish ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-brand-gray-300">
              Unpublishing removes you from Discover: venues, buyers, and
              labels can&apos;t find or message you until you republish. Your
              photos and profile are kept safe. Confirm?
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmingUnpublish(false)}
                disabled={busy}
                className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-brand-gray-300 tappable hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={busy}
                className="rounded-full border border-red-500/40 bg-red-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
              >
                {busy ? "Unpublishing…" : "Yes, unpublish"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingUnpublish(true)}
            disabled={busy}
            className="text-xs font-medium text-brand-gray-400 underline-offset-4 transition hover:text-red-300 hover:underline disabled:opacity-50"
          >
            Unpublish profile
          </button>
        )}
      </div>
    </div>
  );
}
