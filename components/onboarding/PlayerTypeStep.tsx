"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Wrench } from "lucide-react";
import {
  PLAYER_TYPE_OPTIONS,
  isVendorPlayerType,
  type PlayerType,
} from "@/lib/types";
import { CATEGORY_META } from "@/lib/directory/categories";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";

type Props = {
  selected: PlayerType | null;
  onSelect: (value: PlayerType) => void;
  onNext: () => void;
  saving: boolean;
  error: string | null;
};

// The main list stays the five roles that play, book, or sign music. The three
// businesses that serve a show sit one level down behind a single "Gear &
// services" choice, so the first question stays short for the people most
// signups are (PROGRESS.md §2 #27).
const CORE_OPTIONS = PLAYER_TYPE_OPTIONS.filter((o) => !isVendorPlayerType(o.value));
const VENDOR_OPTIONS = PLAYER_TYPE_OPTIONS.filter((o) => isVendorPlayerType(o.value));

export function PlayerTypeStep({ selected, onSelect, onNext, saving, error }: Props) {
  const [vendorsOpen, setVendorsOpen] = useState(() => isVendorPlayerType(selected));
  const vendorSelected = isVendorPlayerType(selected);

  // Someone who arrives already a vendor (a directory "claim your listing"
  // link, or resuming onboarding) gets the group open so their choice is
  // visible. An effect rather than the initial state alone: the type from the
  // link is applied by the parent after this first renders.
  useEffect(() => {
    if (vendorSelected) setVendorsOpen(true);
  }, [vendorSelected]);

  return (
    <div className="animate-fade-in">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-brand-gray-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Who are you?</h1>
        <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
          Pick the role that best describes how you&apos;ll use SplitMic.
        </p>
      </header>

      <div className="space-y-3">
        {CORE_OPTIONS.map((option) => {
          const isActive = selected === option.value;
          return (
            <label
              key={option.value}
              className={`tappable-lg flex cursor-pointer items-start gap-4 rounded-xl border p-4 focus-within:ring-2 focus-within:ring-brand-orange/50 sm:p-5 ${
                isActive
                  ? "border-brand-orange bg-brand-orange/10"
                  : "border-white/10 bg-brand-gray-900 hover:border-white/30"
              }`}
            >
              <input
                type="radio"
                name="player_type"
                value={option.value}
                checked={isActive}
                onChange={() => onSelect(option.value)}
                className="sr-only"
              />
              <span
                className={`mt-0.5 shrink-0 ${
                  isActive ? "text-brand-orange" : "text-brand-gray-300"
                }`}
                aria-hidden="true"
              >
                <PlayerTypeIcon
                  type={option.value}
                  className="h-7 w-7"
                  strokeWidth={1.75}
                />
              </span>
              <span className="flex-1">
                <span className="block text-base font-semibold sm:text-lg">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-sm text-brand-gray-300">
                  {option.description}
                </span>
              </span>
              <RadioDot active={isActive} />
            </label>
          );
        })}

        {/* Gear & services: a disclosure, not a value. Opening it reveals the
            three business types, which are ordinary radios in the same group.
            One per row at every width: this column is max-w-xl even on
            desktop, and three across squeezed each description to a sliver. */}
        <div
          className={`rounded-xl border ${
            vendorSelected || vendorsOpen
              ? "border-brand-orange bg-brand-orange/5"
              : "border-white/10 bg-brand-gray-900"
          }`}
        >
          <button
            type="button"
            onClick={() => setVendorsOpen((open) => !open)}
            aria-expanded={vendorsOpen}
            aria-controls="vendor-player-types"
            className="tappable-lg flex w-full items-start gap-4 rounded-xl p-4 text-left hover:bg-white/[.03] sm:p-5"
          >
            <span
              className={`mt-0.5 shrink-0 ${
                vendorSelected ? "text-brand-orange" : "text-brand-gray-300"
              }`}
              aria-hidden="true"
            >
              <Wrench className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <span className="flex-1">
              <span className="block text-base font-semibold sm:text-lg">
                Gear &amp; Services
              </span>
              <span className="mt-0.5 block text-sm text-brand-gray-300">
                Backline companies, instrument rental, and rehearsal studios.
              </span>
            </span>
            <ChevronDown
              className={`mt-1 h-5 w-5 shrink-0 text-brand-gray-300 transition-transform duration-200 ${
                vendorsOpen ? "rotate-180" : ""
              }`}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>

          {vendorsOpen ? (
            <div
              id="vendor-player-types"
              className="grid grid-cols-1 gap-3 px-4 pb-4 sm:px-5 sm:pb-5"
            >
              {VENDOR_OPTIONS.map((option) => {
                const isActive = selected === option.value;
                // Same photo as the directory tile for this category, so the
                // business sees the listing they may already have.
                const image = isVendorPlayerType(option.value)
                  ? CATEGORY_META[option.value].image
                  : undefined;
                return (
                  <label
                    key={option.value}
                    className={`tappable-lg flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl border focus-within:ring-2 focus-within:ring-brand-orange/50 ${
                      isActive
                        ? "border-brand-orange bg-brand-orange/10"
                        : "border-white/10 bg-black/40 hover:border-white/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="player_type"
                      value={option.value}
                      checked={isActive}
                      onChange={() => onSelect(option.value)}
                      className="sr-only"
                    />
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        className="min-h-[72px] w-24 shrink-0 self-stretch object-cover"
                      />
                    ) : null}
                    <span className="flex min-w-0 flex-1 items-center gap-2 py-3 pr-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold sm:text-base">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-brand-gray-300">
                          {option.description}
                        </span>
                      </span>
                      <RadioDot active={isActive} />
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!selected || saving}
          className="btn-primary sm:min-w-[160px]"
        >
          {saving ? "Saving…" : "Next"}
        </button>
      </div>
    </div>
  );
}

function RadioDot({ active }: { active: boolean }) {
  return (
    <span
      className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
        active ? "border-brand-orange bg-brand-orange" : "border-white/30"
      }`}
      aria-hidden="true"
    >
      {active ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
    </span>
  );
}
