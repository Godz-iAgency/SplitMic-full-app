"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { writePendingProfile } from "@/lib/pendingProfile";
import type { PlayerType } from "@/lib/types";
import { MiniProfileBuilder } from "./MiniProfileBuilder";
import { PlayerTypeIcon } from "./PlayerTypeIcon";

export type PlayerTypeDetail = {
  type: PlayerType;
  name: string;
  headline: string;
  benefits: string[];
  /** Public path to the player-type photo, e.g. "/players/band.jpg" */
  image: string;
};

type Props = {
  detail: PlayerTypeDetail | null;
  onClose: () => void;
};

export function PlayerTypeModal({ detail, onClose }: Props) {
  // "pitch" = why this platform is for you. "build" = the mini profile builder.
  // Splitting the modal in two puts a small act of building before the signup
  // wall (IKEA effect) without adding a route or a page load.
  const [phase, setPhase] = useState<"pitch" | "build">("pitch");
  const [genres, setGenres] = useState<string[]>([]);
  const [scale, setScale] = useState("");

  const activeType = detail?.type ?? null;

  // Reopening the modal on a different role starts that role over: its
  // questions and answers are not the ones already on screen.
  useEffect(() => {
    setPhase("pitch");
    setGenres([]);
    setScale("");
  }, [activeType]);

  // Close on ESC key
  useEffect(() => {
    if (!detail) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    // Lock body scroll while modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [detail, onClose]);

  if (!detail) return null;

  const shortName = detail.name.replace(/s$/, "");
  const answered = genres.length > 0 || scale !== "";

  /** Hand the answers to onboarding. Runs on the way out, for both the
   *  answered and skipped paths, so the player type is always carried. */
  function persist() {
    if (!detail) return;
    writePendingProfile({ type: detail.type, genres, scale });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-headline"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:px-6"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Modal panel — max-h keeps it within the viewport; content scrolls inside */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl animate-slide-up flex-col overflow-hidden rounded-3xl border border-brand-orange/30 bg-gradient-to-b from-brand-gray-900 to-black shadow-2xl shadow-brand-orange/20">
        {/* Close button — anchored to the panel, always visible */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white transition hover:border-white/30 hover:bg-white/10"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Scrollable content area */}
        <div className="overflow-y-auto">
          {/* Photo banner */}
          <div className="relative h-40 w-full sm:h-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={detail.image}
              alt={detail.name}
              className="h-full w-full object-cover"
            />
            {/* Gradient so the close button + text stay readable over any photo */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30" />
          </div>

          {/* Header */}
          <div className="border-b border-brand-gray-800 bg-black/40 px-8 pb-6 pt-5 text-center">
            <div className="mb-3 flex justify-center text-brand-orange">
              <PlayerTypeIcon
                type={detail.type}
                className="h-10 w-10"
                strokeWidth={1.5}
              />
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-brand-orange">
              For {detail.name}
            </p>
            <h2
              id="modal-headline"
              className="mt-3 text-2xl font-black sm:text-3xl"
            >
              {detail.headline}
            </h2>
          </div>

          {/* Body */}
          <div className="px-8 py-6">
            {phase === "pitch" ? (
              <>
                <ul className="space-y-3">
                  {detail.benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-start gap-3 text-sm text-brand-gray-200 sm:text-base"
                    >
                      <span
                        className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-orange text-white"
                        aria-hidden="true"
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-col items-center pb-2">
                  <button
                    type="button"
                    onClick={() => setPhase("build")}
                    className="w-full rounded-xl bg-brand-orange px-8 py-4 text-center text-lg font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:bg-orange-600 hover:shadow-brand-orange/50 sm:w-auto sm:min-w-[300px]"
                  >
                    Start My {shortName} Profile
                  </button>
                  <p className="mt-4 text-xs text-brand-gray-400">
                    Two quick questions first. Free · No credit card.
                  </p>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPhase("pitch")}
                  className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-gray-400 transition hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  Back
                </button>

                <MiniProfileBuilder
                  playerType={detail.type}
                  genres={genres}
                  scale={scale}
                  onGenresChange={setGenres}
                  onScaleChange={setScale}
                />

                <div className="mt-7 flex flex-col items-center pb-2">
                  <Link
                    href={`/signup?type=${detail.type}`}
                    onClick={persist}
                    className="w-full rounded-xl bg-brand-orange px-8 py-4 text-center text-lg font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:bg-orange-600 hover:shadow-brand-orange/50 sm:w-auto sm:min-w-[300px]"
                  >
                    {answered ? "Save and create my account" : "Create my account"}
                  </Link>
                  <p className="mt-4 text-center text-xs text-brand-gray-400">
                    {answered
                      ? "Your answers carry into your profile, so onboarding picks up where you left off."
                      : "Both are optional. You can fill them in during onboarding instead."}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
