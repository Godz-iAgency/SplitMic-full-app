"use client";

import { useState } from "react";
import { publishProfile, unpublishProfile } from "@/app/profile/[id]/actions";

type Props = {
  profileId: string;
  isPublished: boolean;
};

/**
 * Fast, always-visible publish/unpublish control for the profile header.
 * The bottom-of-page cards (PublishButton's persuasion copy, ProfileLiveStatus's
 * Update + confirmed unpublish) still exist below and stay in sync with this,
 * since both read the same is_published state, this is just a shortcut so
 * publishing never requires scrolling to find.
 */
export function PublishToggle({ profileId, isPublished }: Props) {
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
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpublish() {
    // A plain confirm, not a custom popover: unpublishing removes you from
    // every search result and message request, worth one deliberate step,
    // but not worth a bigger UI here since the bottom card already has the
    // fuller confirm flow for anyone who lands there instead.
    const confirmed = window.confirm(
      "Unpublish your profile? Nobody can find you until you publish again.",
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const result = await unpublishProfile(profileId);
      if (!result.ok) setError(result.error ?? "Could not unpublish.");
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {isPublished ? (
        <button
          type="button"
          onClick={handleUnpublish}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-orange/40 bg-brand-orange/10 px-4 py-2 text-sm font-bold text-brand-orange transition hover:bg-brand-orange/20 disabled:opacity-50"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-orange opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-orange" />
          </span>
          {busy ? "Unpublishing…" : "Live"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handlePublish}
          disabled={busy}
          className="rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-black transition hover:bg-brand-orange/90 disabled:opacity-50"
        >
          {busy ? "Publishing…" : "Publish"}
        </button>
      )}
      {error ? <p className="text-xs font-medium text-red-400">{error}</p> : null}
    </div>
  );
}
