"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Fullscreen video overlay shown once after onboarding completes.
 * Triggered by `?welcome=1` query param. Auto-plays muted, fades out
 * when the video ends (or after 12s as a hard cap), and clears the
 * query param so reloads don't replay.
 */
export function WelcomeIntro() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldShow = searchParams.get("welcome") === "1";

  const [visible, setVisible] = useState(shouldShow);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!shouldShow) return;

    // Hard cap in case the video stalls or never fires `ended`
    const cap = setTimeout(() => dismiss(), 12000);
    return () => clearTimeout(cap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  function dismiss() {
    setFading(true);
    // Wait for fade-out transition before unmounting
    setTimeout(() => {
      setVisible(false);
      // Strip ?welcome=1 from the URL so a refresh doesn't replay
      router.replace("/search");
    }, 600);
  }

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        onEnded={dismiss}
        onError={dismiss}
        className="h-full w-full object-cover sm:object-contain"
      />
      <button
        type="button"
        onClick={dismiss}
        className="absolute bottom-6 right-6 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur transition hover:bg-white/20"
      >
        Skip
      </button>
    </div>
  );
}
