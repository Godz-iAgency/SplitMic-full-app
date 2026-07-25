"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { updateMarketplacePost } from "@/app/opportunities/actions";
import { GenreMultiSelect } from "./GenreMultiSelect";
import { PlayerTypeMultiSelect } from "./PlayerTypeMultiSelect";
import type { PlayerType } from "@/lib/types";

type PostType = "event" | "opportunity" | "open_mic";

type Props = {
  postId: string;
  postType: PostType;
  playerType: PlayerType;
  initial: {
    title: string;
    description: string;
    event_date: string;
    event_end_date: string;
    event_location: string;
    open_until: string;
    genres: string[];
    pay_info: string;
    player_types_wanted: PlayerType[];
  };
};

export function PostEditForm({
  postId,
  postType,
  playerType,
  initial,
}: Props) {
  const router = useRouter();
  const isEvent = postType === "event";
  const isOpenMic = postType === "open_mic";
  const isDateBased = isEvent || isOpenMic;
  const isMultiDayEvent = playerType === "festival" && postType === "event";

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [eventDate, setEventDate] = useState(initial.event_date);
  const [eventEndDate, setEventEndDate] = useState(initial.event_end_date);
  const [eventLocation, setEventLocation] = useState(initial.event_location);
  const [openUntil, setOpenUntil] = useState(initial.open_until);
  const [genres, setGenres] = useState<string[]>(initial.genres);
  const [payInfo, setPayInfo] = useState(initial.pay_info);
  const [playerTypesWanted, setPlayerTypesWanted] = useState<PlayerType[]>(
    initial.player_types_wanted,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const expiryPreview = useMemo(() => {
    let base: string;
    if (isDateBased) {
      base = isMultiDayEvent && eventEndDate ? eventEndDate : eventDate;
    } else {
      base = openUntil;
    }
    if (!base) return null;
    const d = new Date(base + "T12:00:00");
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [postType, eventDate, eventEndDate, openUntil, isMultiDayEvent]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (isDateBased && !eventDate) {
      setError("A date is required.");
      return;
    }
    if (isMultiDayEvent && eventEndDate && eventEndDate < eventDate) {
      setError("End date must be on or after the start date.");
      return;
    }
    if (postType === "opportunity" && !openUntil) {
      setError("'Open until' date is required.");
      return;
    }

    startTransition(async () => {
      const { error: serverError } = await updateMarketplacePost({
        postId,
        title: title.trim(),
        description: description.trim(),
        event_date: isDateBased ? eventDate : undefined,
        event_end_date:
          isMultiDayEvent && eventEndDate ? eventEndDate : undefined,
        event_location: isDateBased ? eventLocation.trim() : undefined,
        open_until: postType === "opportunity" ? openUntil : undefined,
        genres,
        pay_info: payInfo.trim(),
        player_types_wanted: playerTypesWanted,
      });

      if (serverError) {
        setError(serverError);
        return;
      }

      router.push(`/opportunities/${postId}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/[.05] via-white/[.03] to-transparent p-6 shadow-lg shadow-black/30 sm:p-8"
    >
      {/* Subtle orange glow accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-orange/10 blur-3xl"
      />

      <div className="relative space-y-6">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-brand-orange">
            <Pencil className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
            Editing
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] ${
              isEvent
                ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30"
                : isOpenMic
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                  : "bg-blue-500/20 text-blue-300 border-blue-500/30"
            }`}
          >
            {isEvent ? "Event" : isOpenMic ? "Open Mic" : "Opportunity"}
          </span>
        </div>

        {/* Title */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Title <span className="text-brand-orange">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-brand-gray-500 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
          />
          <p className="mt-1 text-right text-xs text-brand-gray-500">
            {title.length}/120
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={5}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-brand-gray-500 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
          />
          <p className="mt-1 text-right text-xs text-brand-gray-500">
            {description.length}/2000
          </p>
        </div>

        {/* Date-based fields (events + open mics) */}
        {isDateBased ? (
          <>
            {isMultiDayEvent ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Start date <span className="text-brand-orange">*</span>
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => {
                      setEventDate(e.target.value);
                      if (eventEndDate && eventEndDate < e.target.value) {
                        setEventEndDate("");
                      }
                    }}
                    required
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    End date
                  </label>
                  <input
                    type="date"
                    value={eventEndDate}
                    min={eventDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40 [color-scheme:dark]"
                  />
                  <p className="mt-1 text-xs text-brand-gray-400">
                    Optional, leave blank for a single-day festival.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {!isMultiDayEvent ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    {isOpenMic ? "Open mic date" : "Event date"}{" "}
                    <span className="text-brand-orange">*</span>
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40 [color-scheme:dark]"
                  />
                </div>
              ) : null}
              <div className={isMultiDayEvent ? "sm:col-span-2" : ""}>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Location
                </label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Mohawk Austin, 912 Red River St"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-brand-gray-500 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
                />
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Open until <span className="text-brand-orange">*</span>
            </label>
            <input
              type="date"
              value={openUntil}
              onChange={(e) => setOpenUntil(e.target.value)}
              required
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40 [color-scheme:dark]"
            />
            <p className="mt-1 text-xs text-brand-gray-400">
              The deadline for responses. Post auto-removes 7 days after this
              date.
            </p>
          </div>
        )}

        <GenreMultiSelect selected={genres} onChange={setGenres} />

        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Pay / deal
          </label>
          <input
            type="text"
            value={payInfo}
            onChange={(e) => setPayInfo(e.target.value)}
            placeholder="$200 guarantee, door deal, exposure…"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-brand-gray-500 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
          />
        </div>

        <PlayerTypeMultiSelect
          selected={playerTypesWanted}
          onChange={setPlayerTypesWanted}
        />

        {expiryPreview ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-brand-gray-300">
            ⏱ Updated post will be automatically removed on{" "}
            <span className="font-semibold text-white">{expiryPreview}</span>.
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {/* Save + Cancel */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Link
            href={`/opportunities/${postId}`}
            className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-brand-orange px-8 py-3 text-sm font-bold text-black transition hover:bg-brand-orange/90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
