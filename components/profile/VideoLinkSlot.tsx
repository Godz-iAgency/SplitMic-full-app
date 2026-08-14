"use client";

import { useState, useTransition } from "react";
import { Video, Check, X } from "lucide-react";
import { saveIntroVideoUrl } from "@/app/profile/edit/actions";
import { resolveVideoEmbed } from "@/lib/media/videoEmbed";
import { VideoEmbedFrame } from "./VideoEmbedFrame";

/**
 * Paste-a-link intro video, replacing the old upload slot.
 *
 * Resolves the link as the user types so they see the actual player before
 * saving — a wrong link is obvious immediately instead of after a save and a
 * page load. The same resolver runs again server-side on save; this one is
 * purely for feedback.
 */
export function VideoLinkSlot({
  profileId,
  initialUrl,
  onSuccess,
}: {
  profileId: string;
  initialUrl: string | null;
  /** Reuses MediaManager's toast. */
  onSuccess?: (message: string) => void;
}) {
  const [value, setValue] = useState(initialUrl ?? "");
  const [savedUrl, setSavedUrl] = useState(initialUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const trimmed = value.trim();
  const dirty = trimmed !== savedUrl.trim();
  const preview = trimmed ? resolveVideoEmbed(trimmed) : null;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveIntroVideoUrl(profileId, trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedUrl(trimmed);
      onSuccess?.(trimmed ? "Intro video saved" : "Intro video removed");
    });
  }

  function clear() {
    setValue("");
    setError(null);
    startTransition(async () => {
      const result = await saveIntroVideoUrl(profileId, "");
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedUrl("");
      onSuccess?.("Intro video removed");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Video
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400"
            aria-hidden="true"
          />
          <input
            type="url"
            inputMode="url"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="Paste a YouTube, Vimeo, or Loom link…"
            aria-label="Intro video link"
            className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange/60 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty || (trimmed !== "" && !preview?.ok)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-black transition hover:bg-brand-orange/90 disabled:opacity-40"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {busy ? "Saving…" : "Save"}
          </button>

          {savedUrl ? (
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-40"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Remove
            </button>
          ) : null}
        </div>
      </div>

      {/* Server-side rejection (the authoritative one). */}
      {error ? (
        <p role="alert" className="text-sm leading-relaxed text-red-300">
          {error}
        </p>
      ) : null}

      {/* Live client-side feedback while typing. */}
      {!error && preview && !preview.ok ? (
        <p className="text-sm leading-relaxed text-amber-300/90">{preview.reason}</p>
      ) : null}

      {preview?.ok ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-gray-400">
            Preview · {preview.embed.providerLabel}
            {dirty ? " · unsaved" : ""}
          </p>
          <VideoEmbedFrame embed={preview.embed} />
          {preview.embed.provider === "google_drive" ? (
            <p className="text-xs leading-relaxed text-brand-gray-400">
              Drive files only play for visitors if sharing is set to “Anyone
              with the link.”
            </p>
          ) : null}
        </div>
      ) : null}

      {!trimmed ? (
        <p className="text-xs leading-relaxed text-brand-gray-400">
          Works with YouTube, Vimeo, Loom, SoundCloud, Spotify, and Google
          Drive. It plays right on your profile — visitors never leave SplitMic.
          No length limit.
        </p>
      ) : null}
    </div>
  );
}
