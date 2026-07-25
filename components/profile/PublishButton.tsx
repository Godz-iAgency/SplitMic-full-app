"use client";

import { useState } from "react";
import { publishProfile } from "@/app/profile/[id]/actions";

type Props = {
  profileId: string;
  /** Count of already-published profiles, used to frame publishing as a loss
   *  (you're invisible to a real, sized network) rather than a plain instruction. */
  liveProfileCount: number;
};

export function PublishButton({ profileId, liveProfileCount }: Props) {
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
            You&apos;re invisible right now
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-brand-gray-300">
            {liveProfileCount > 0
              ? `${liveProfileCount} bands, venues, and buyers are already live on SplitMic, and none of them can find you yet. Publish to join them.`
              : "Nobody in Austin's music scene can find or message you until you publish. You can always unpublish later."}
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
