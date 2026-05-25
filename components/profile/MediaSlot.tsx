"use client";

import { useRef, useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import {
  uploadProfileMedia,
  deleteProfileMedia,
  publicUrlFor,
} from "@/lib/media/upload";
import {
  ACCEPT_IMAGE,
  ACCEPT_VIDEO,
  validateMedia,
  type MediaKind,
} from "@/lib/media/validate";
import { BannerCropModal } from "./BannerCropModal";

export type ExistingMedia = {
  id: string;
  storage_path: string;
  kind: MediaKind;
  duration_seconds: number | null;
} | null;

type Props = {
  kind: MediaKind;
  userId: string;
  profileId: string;
  existing: ExistingMedia;
  label: string;
  hint?: string;
  className?: string;
  /** Classes applied to the inline error block (e.g. to indent past an overlapping avatar) */
  errorClassName?: string;
  shape?: "circle" | "wide" | "square";
  /** When true, hide the hint+Remove footer below the slot. Remove still available via the hover overlay. */
  compact?: boolean;
  onChange: () => void;
  onSuccess?: (message: string) => void;
};

export function MediaSlot({
  kind,
  userId,
  profileId,
  existing,
  label,
  hint,
  className,
  errorClassName,
  shape = "square",
  compact = false,
  onChange,
  onSuccess,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const supabase = createClientSupabaseClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);

  const accept = kind === "video" ? ACCEPT_VIDEO : ACCEPT_IMAGE;
  const currentUrl = existing
    ? publicUrlFor(supabase, existing.storage_path)
    : null;

  function openPicker() {
    setError(null); // Auto-clear any prior error the moment they retry
    inputRef.current?.click();
  }

  /** Routes a freshly-picked file. Banner files open the crop modal first. */
  async function handlePickedFile(file: File) {
    setError(null);

    if (kind === "banner") {
      // Pre-validate so users don't crop a file we'd reject afterward
      const validationError = await validateMedia(file, kind);
      if (validationError) {
        setError(validationError.message);
        return;
      }
      setPendingBannerFile(file);
      return;
    }

    await handleFile(file);
  }

  async function handleFile(file: File) {
    setError(null); // Auto-clear any prior error when a new file is picked
    setBusy(true);
    try {
      const result = await uploadProfileMedia(supabase, {
        file,
        kind,
        userId,
        profileId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onChange();
      onSuccess?.(successMessageFor(kind));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!existing) return;
    if (!confirm(`Remove this ${kind}?`)) return;
    setError(null);
    setBusy(true);
    try {
      const result = await deleteProfileMedia(supabase, existing.id);
      if (!result.ok) {
        setError(result.error ?? "Could not remove.");
        return;
      }
      onChange();
      onSuccess?.(`${capitalize(kind)} removed`);
    } finally {
      setBusy(false);
    }
  }

  const shapeClass =
    shape === "circle"
      ? "aspect-square rounded-full"
      : shape === "wide"
        ? "aspect-[3/1] rounded-xl"
        : "aspect-square rounded-xl";

  const errorBlock = error ? (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-lg border border-red-500/50 bg-red-950/95 p-3 text-xs leading-relaxed text-red-100 shadow-lg backdrop-blur ${errorClassName ?? ""}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="mt-0.5 shrink-0"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
      </svg>
      <div className="flex-1 space-y-2">
        <p>{error}</p>
        <button
          type="button"
          onClick={openPicker}
          className="inline-block rounded-md border border-red-400/50 bg-red-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-red-500/40"
        >
          Try again
        </button>
      </div>
      <button
        type="button"
        onClick={() => setError(null)}
        className="shrink-0 rounded p-1 text-red-300 hover:bg-red-500/20 hover:text-white"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  ) : null;

  return (
    <div className={className}>
      <div
        className={`group relative flex w-full items-center justify-center overflow-hidden border border-white/10 bg-brand-gray-900/60 ${shapeClass}`}
      >
        {currentUrl ? (
          kind === "video" ? (
            <video
              src={currentUrl}
              controls
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUrl}
              alt={label}
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <div className="flex flex-col items-center text-center text-brand-gray-400">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            <span className="mt-1 text-xs font-medium uppercase tracking-wider">
              {label}
            </span>
          </div>
        )}

        {/* Always-visible busy state */}
        {busy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-xs font-semibold uppercase tracking-wider text-white">
            <span className="animate-pulse">Uploading…</span>
          </div>
        ) : null}

        {/* Hover overlay with Replace + Remove */}
        <div
          className={`absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition group-hover:opacity-100 ${shape === "circle" ? "flex-col" : ""}`}
        >
          <button
            type="button"
            onClick={openPicker}
            disabled={busy}
            className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur transition hover:bg-white/25"
          >
            {currentUrl ? "Replace" : "Upload"}
          </button>
          {existing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-full bg-red-500/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-red-500"
            >
              Remove
            </button>
          ) : null}
        </div>

        {/* For wide banners: error overlays the bottom-right of the image so it doesn't push the layout down */}
        {error && shape === "wide" ? (
          <div className="absolute bottom-3 right-3 z-30 max-w-xs">
            {errorBlock}
          </div>
        ) : null}
      </div>

      {compact ? null : (
        <div className="mt-2 flex items-start justify-between gap-3">
          {hint ? (
            <p className="text-xs leading-snug text-brand-gray-400">{hint}</p>
          ) : (
            <span />
          )}
        </div>
      )}

      {/* For non-wide slots: error appears inline below the image */}
      {error && shape !== "wide" ? <div className="mt-2">{errorBlock}</div> : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePickedFile(file);
          // Reset so picking the same file twice still triggers onChange
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      {/* Banner crop modal — only mounted while a banner file is awaiting confirmation */}
      {pendingBannerFile ? (
        <BannerCropModal
          file={pendingBannerFile}
          onCancel={() => setPendingBannerFile(null)}
          onConfirm={async (cropped) => {
            setPendingBannerFile(null);
            await handleFile(cropped);
          }}
        />
      ) : null}
    </div>
  );
}

function successMessageFor(kind: MediaKind): string {
  switch (kind) {
    case "avatar":
      return "Profile photo uploaded";
    case "banner":
      return "Banner uploaded";
    case "video":
      return "Video uploaded";
    default:
      return "Photo uploaded";
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
