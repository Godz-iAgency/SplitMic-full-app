"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaSlot, type ExistingMedia } from "./MediaSlot";
import { VideoLinkSlot } from "./VideoLinkSlot";
import type { MediaKind } from "@/lib/media/validate";

export type MediaRow = {
  id: string;
  kind: MediaKind;
  storage_path: string;
  duration_seconds: number | null;
};

type Props = {
  userId: string;
  profileId: string;
  media: MediaRow[];
  /** Current intro video link, or null if they haven't set one. */
  introVideoUrl: string | null;
  /**
   * When provided, the "Done" button saves the profile-info form (rendered as
   * a sibling) before navigating, instead of just linking away. Falls back to
   * a plain link when omitted. Resolves true on success (navigating away —
   * the button should stay disabled rather than flash back to normal for a
   * frame before the new page takes over) or false on failure (re-enable so
   * the user can retry).
   */
  onDone?: () => Promise<boolean>;
  /** Swaps the finish button's copy to reflect that this save also publishes
   *  the profile (the post-onboarding first pass through this page). */
  publishOnDone?: boolean;
};

export function MediaManager({
  userId,
  profileId,
  media,
  introVideoUrl,
  onDone,
  publishOnDone,
}: Props) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const [toast, setToast] = useState<string | null>(null);
  const [showBannerHelp, setShowBannerHelp] = useState(false);
  const [doneSaving, setDoneSaving] = useState(false);

  // Auto-dismiss toast after 2.5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSuccess = (message: string) => setToast(message);

  const avatar = findOne(media, "avatar");
  const banner = findOne(media, "banner");
  const gallery = media.filter((m) => m.kind === "gallery");

  const gallerySlots: ExistingMedia[] = [0, 1, 2].map((i) =>
    gallery[i]
      ? {
          id: gallery[i].id,
          kind: "gallery" as const,
          storage_path: gallery[i].storage_path,
          duration_seconds: null,
        }
      : null,
  );

  const profileViewHref = `/profile/${profileId}`;
  const doneLabel = publishOnDone
    ? "Done, publish my profile →"
    : "Done, view my profile →";

  return (
    <div className="space-y-12">
      {/* Banner with avatar overlapping */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
            Banner & profile photo
          </h2>
          <button
            type="button"
            onClick={() => setShowBannerHelp((v) => !v)}
            aria-label="What sizes work best?"
            className="flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-[10px] font-semibold text-brand-gray-300 transition hover:border-brand-orange/50 hover:text-white"
          >
            ?
          </button>
        </div>

        {showBannerHelp ? (
          <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-brand-gray-300">
            <p>
              <span className="font-medium text-white">Banner</span> is wide
              (3:1). For zero cropping, design at <strong>2400×800</strong>.
              Otherwise we crop the top and bottom, same as Twitter, LinkedIn,
              and Facebook.
            </p>
            <p className="mt-2">
              <span className="font-medium text-white">Profile photo</span>:
              square works best (we resize to 800×800).
            </p>
            <p className="mt-2">
              JPG / PNG / WebP, up to 25 MB. We compress automatically.
            </p>
          </div>
        ) : null}

        <div className="relative">
          <MediaSlot
            kind="banner"
            userId={userId}
            profileId={profileId}
            existing={banner}
            shape="wide"
            label="Add banner"
            compact
            onChange={refresh}
            onSuccess={handleSuccess}
          />

          <div className="absolute -bottom-12 left-4 w-24 sm:left-8 sm:w-28">
            <div className="rounded-full ring-4 ring-black">
              <MediaSlot
                kind="avatar"
                userId={userId}
                profileId={profileId}
                existing={avatar}
                shape="circle"
                label="Photo"
                compact
                onChange={refresh}
                onSuccess={handleSuccess}
              />
            </div>
          </div>
        </div>

        <div className="mt-16 sm:mt-20" />
      </section>

      {/* Gallery */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
          Gallery (up to 3)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {gallerySlots.map((slot, i) => (
            <MediaSlot
              key={slot?.id ?? `empty-${i}`}
              kind="gallery"
              userId={userId}
              profileId={profileId}
              existing={slot}
              shape="square"
              label={`Photo ${i + 1}`}
              hint="JPG / PNG / WebP, up to 25 MB."
              onChange={refresh}
              onSuccess={handleSuccess}
            />
          ))}
        </div>
      </section>

      {/* Intro video — a link to a video they already host, embedded on the
          profile. Replaced the old 30s/50MB upload slot. */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
          Intro video
        </h2>
        <VideoLinkSlot
          profileId={profileId}
          initialUrl={introVideoUrl}
          onSuccess={handleSuccess}
        />
      </section>

      {/* Done bar */}
      <div className="sticky bottom-4 mt-12 flex flex-col-reverse items-stretch gap-3 rounded-xl border border-white/10 bg-black/80 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-brand-gray-400 sm:max-w-md">
          Photos and video save automatically as you upload.
        </p>
        {onDone ? (
          <button
            type="button"
            disabled={doneSaving}
            onClick={async () => {
              setDoneSaving(true);
              const succeeded = await onDone();
              // On success, leave the button disabled: the page is about to
              // unmount once navigation lands. Resetting here first is what
              // caused the flash back to this form before the swap.
              if (!succeeded) setDoneSaving(false);
            }}
            className="btn-primary text-center"
          >
            {doneSaving ? "Saving…" : doneLabel}
          </button>
        ) : (
          <Link href={profileViewHref} className="btn-primary text-center">
            {doneLabel}
          </Link>
        )}
      </div>

      {/* Success toast */}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 animate-fade-in rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function findOne(media: MediaRow[], kind: MediaKind): ExistingMedia {
  const row = media.find((m) => m.kind === kind);
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    storage_path: row.storage_path,
    duration_seconds: row.duration_seconds,
  };
}
