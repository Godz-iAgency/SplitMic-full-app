"use client";

import { Logo } from "@/components/Logo";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
      <Logo className="mb-8 text-3xl" />
      <p className="text-5xl">📡</p>
      <h1 className="mt-6 text-2xl font-bold text-white sm:text-3xl">
        You&apos;re offline
      </h1>
      <p className="mt-3 max-w-sm text-sm text-brand-gray-300 sm:text-base">
        SplitMic needs an internet connection to fetch live posts, profiles,
        and messages. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.location.reload();
        }}
        className="mt-8 rounded-full bg-brand-orange px-6 py-2.5 text-sm font-bold text-black transition hover:bg-brand-orange/90"
      >
        Try again
      </button>
    </main>
  );
}
