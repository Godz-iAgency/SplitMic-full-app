"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { getCroppedImg } from "@/lib/media/cropImage";

type Props = {
  file: File;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
};

/**
 * Full-screen modal that lets the user drag/zoom the banner image
 * to choose which part shows in the 3:1 crop window.
 * On confirm, exports the cropped region as a JPEG File.
 */
export function BannerCropModal({ file, onConfirm, onCancel }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build the object URL once, clean it up on unmount
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Lock background scroll while the modal is open
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleSave() {
    if (!imageUrl || !croppedAreaPixels) return;
    setBusy(true);
    setError(null);
    try {
      const cropped = await getCroppedImg(imageUrl, croppedAreaPixels, file.name);
      onConfirm(cropped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save crop.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8">
        <div>
          <h2 className="text-base font-semibold text-white">
            Reposition your banner
          </h2>
          <p className="mt-0.5 text-xs text-brand-gray-400">
            Drag the image and use the slider to zoom. The orange box is what
            people will see.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full p-2 text-brand-gray-300 tappable hover:bg-white/5 hover:text-white disabled:opacity-50"
          aria-label="Cancel"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Crop surface */}
      <div className="relative flex-1 bg-black">
        {imageUrl ? (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={3 / 1}
            minZoom={1}
            maxZoom={3}
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="horizontal-cover"
            showGrid={false}
            style={{
              cropAreaStyle: {
                border: "2px solid #FF6B2C",
                color: "rgba(0, 0, 0, 0.6)",
              },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-brand-gray-400">
            Loading image…
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="border-t border-white/10 bg-black/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-brand-gray-400">
              Zoom
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-brand-orange"
              aria-label="Zoom"
            />
          </div>

          {error ? (
            <p className="text-xs font-medium text-red-400">{error}</p>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white tappable hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !croppedAreaPixels}
              className="rounded-full bg-brand-orange px-6 py-2 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-brand-orange/80 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save banner"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
