"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "splitmic_pwa_install_dismissed_at";
const DISMISS_DAYS = 14; // re-show prompt every 2 weeks if still not installed

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Custom install prompt for the SplitMic PWA.
 * - Captures the browser's beforeinstallprompt event so we can show our own UI
 * - Dismissible; remembers dismissal for DISMISS_DAYS days
 * - Hides automatically when the app is already installed
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed → never show
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Recently dismissed → don't nag
    const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const days =
        (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_DAYS) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "dismissed") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDeferredPrompt(null);
    setVisible(false);
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-brand-orange/30 bg-black/95 p-4 shadow-2xl backdrop-blur-xl sm:bottom-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15">
          <Download className="h-5 w-5 text-brand-orange" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            Install SplitMic
          </p>
          <p className="mt-0.5 text-xs text-brand-gray-300">
            Add it to your home screen. Faster, full-screen, no browser bar.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="rounded-full bg-brand-orange px-4 py-1.5 text-xs font-bold text-black transition hover:bg-brand-orange/90"
            >
              Install
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-brand-gray-400 transition hover:text-white"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-brand-gray-400 transition hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
