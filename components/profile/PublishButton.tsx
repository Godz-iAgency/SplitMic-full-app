"use client";

import { useState } from "react";
import { publishProfile } from "@/app/profile/[id]/actions";

type Props = {
  profileId: string;
};

export function PublishButton({ profileId }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setBusy(true);
    setError(null);
    try {
      const result = await publishProfile(profileId);
      if (!result.ok) setError(result.error ?? "Could not publish.");
      // On success the server calls revalidatePath → page re-renders with is_published true
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-12 rounded-xl border border-brand-orange/40 bg-brand-orange/8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">
            You&apos;re not live yet
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-brand-gray-300">
            Once you publish, the Austin music scene can discover you in search.
            You can always unpublish from your settings.
          </p>
          {error ? (
            <p className="mt-2 text-xs font-medium text-red-400">{error}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handlePublish}
          disabled={busy}
          className="shrink-0 rounded-full bg-brand-orange px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-brand-orange/80 disabled:opacity-50"
        >
          {busy ? "Publishing…" : "Publish profile →"}
        </button>
      </div>
    </div>
  );
}
