"use client";

import { useEffect } from "react";

export type FeatureDetail = {
  id: string;
  icon: string;
  title: string;
  description: string;
  headline: string;
  copy: string;
};

type Props = {
  detail: FeatureDetail | null;
  onClose: () => void;
};

export function FeatureModal({ detail, onClose }: Props) {
  // Close on ESC key + lock body scroll while open
  useEffect(() => {
    if (!detail) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [detail, onClose]);

  if (!detail) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-modal-headline"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:px-6"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-2xl animate-slide-up overflow-hidden rounded-3xl border border-brand-orange/30 bg-gradient-to-b from-brand-gray-900 to-black shadow-2xl shadow-brand-orange/20">
        {/* Back arrow (top LEFT) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white transition hover:border-white/30 hover:bg-white/10"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="border-b border-brand-gray-800 bg-black/40 px-8 py-10 pt-16 text-center">
          <div className="mb-3 text-6xl">{detail.icon}</div>
          <p className="text-xs uppercase tracking-[0.3em] text-brand-orange">
            {detail.title}
          </p>
          <h2
            id="feature-modal-headline"
            className="mt-3 text-2xl font-black sm:text-3xl"
          >
            {detail.headline}
          </h2>
        </div>

        {/* Body */}
        <div className="px-8 py-8">
          <p className="text-base leading-relaxed text-brand-gray-200 sm:text-lg">
            {detail.copy}
          </p>
        </div>
      </div>
    </div>
  );
}
