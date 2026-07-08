"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "splitmic_pwa_install_dismissed_at";
const INSTALLED_KEY = "splitmic_pwa_installed";
const DISMISS_DAYS = 14; // re-show prompt every 2 weeks if still not installed

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type NavigatorWithInstall = Navigator & {
  getInstalledRelatedApps?: () => Promise<Array<{ platform?: string; url?: string }>>;
  /** iOS Safari legacy standalone flag */
  standalone?: boolean;
};

/**
 * Custom install prompt for the SplitMic PWA.
 * - Captures the browser's beforeinstallprompt event so we can show our own UI
 * - Dismissible; remembers dismissal for DISMISS_DAYS days
 * - Hides permanently once the app is installed, even when the site is later
 *   opened in a normal browser tab (not just standalone). Detection uses three
 *   signals: a persisted INSTALLED_KEY, the standalone display mode, and
 *   navigator.getInstalledRelatedApps(). The `appinstalled` event persists the
 *   flag the moment install completes via any path.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nav = window.navigator as NavigatorWithInstall;

    // Installed on a previous visit (persisted) → never show again
    if (window.localStorage.getItem(INSTALLED_KEY) === "1") return;

    // Currently running as an installed app → record and never show
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true;
    if (isStandalone) {
      window.localStorage.setItem(INSTALLED_KEY, "1");
      return;
    }

    let cancelled = false;

    // Detect an already-installed copy even when viewed in a normal browser
    // tab (Chrome/Android). If found, suppress the prompt permanently. This is
    // the fix for the app re-prompting on phones where it's already installed.
    if (typeof nav.getInstalledRelatedApps === "function") {
      nav
        .getInstalledRelatedApps()
        .then((apps) => {
          if (cancelled) return;
          if (apps && apps.length > 0) {
            window.localStorage.setItem(INSTALLED_KEY, "1");
            setDeferredPrompt(null);
            setVisible(false);
          }
        })
        .catch(() => {});
    }

    // Recently dismissed → don't nag
    const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const days =
        (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_DAYS) return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      // If we've learned it's installed since mount, stay hidden.
      if (window.localStorage.getItem(INSTALLED_KEY) === "1") return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    // Fires once the app is installed via ANY path (our button, browser menu,
    // Add to Home Screen). Persist so we never prompt again on this device.
    const onInstalled = () => {
      window.localStorage.setItem(INSTALLED_KEY, "1");
      window.localStorage.removeItem(DISMISS_KEY);
      setDeferredPrompt(null);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      window.localStorage.setItem(INSTALLED_KEY, "1");
    } else {
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
    <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-brand-orange/30 bg-black/95 p-4 shadow-2xl backdrop-blur-xl lg:bottom-6">
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
