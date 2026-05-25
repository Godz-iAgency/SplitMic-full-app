"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mic, Briefcase } from "lucide-react";
import { createMarketplacePost } from "@/app/opportunities/actions";
import { GenreMultiSelect } from "./GenreMultiSelect";
import { PlayerTypeMultiSelect } from "./PlayerTypeMultiSelect";
import { BandTagPicker } from "./BandTagPicker";
import type { PlayerType } from "@/lib/types";

type PostType = "event" | "opportunity";

type Band = {
  profile_id: string;
  band_name: string;
  avatar_url: string | null;
};

type Props = {
  canPostEvents: boolean;
  playerType: PlayerType;
};

export function PostCreationForm({ canPostEvents, playerType }: Props) {
  const router = useRouter();
  const [postType, setPostType] = useState<PostType | null>(null);

  return (
    <>
      {!postType ? (
        <PostTypeChooser canPostEvents={canPostEvents} onPick={setPostType} />
      ) : (
        <PostFields
          postType={postType}
          playerType={playerType}
          onBack={() => setPostType(null)}
          onCreated={(id) => router.push(`/opportunities/${id}`)}
        />
      )}
    </>
  );
}

function PostTypeChooser({
  canPostEvents,
  onPick,
}: {
  canPostEvents: boolean;
  onPick: (t: PostType) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {canPostEvents ? (
        <button
          type="button"
          onClick={() => onPick("event")}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-brand-orange/50 hover:bg-white/10"
        >
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange/15 text-brand-orange">
            <Mic className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </div>
          <h3 className="text-lg font-bold text-white">Post an Event</h3>
          <p className="mt-1 text-sm text-brand-gray-300">
            A specific show, performance slot, or booking date.
          </p>
          <p className="mt-3 text-xs text-brand-gray-400">
            Stays up until 7 days after your event date.
          </p>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => onPick("opportunity")}
        className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-brand-orange/50 hover:bg-white/10"
      >
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
          <Briefcase className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-white">Post an Opportunity</h3>
        <p className="mt-1 text-sm text-brand-gray-300">
          An ongoing need — A&amp;R search, casting, collaboration, callout.
        </p>
        <p className="mt-3 text-xs text-brand-gray-400">
          You set the deadline. Removes 7 days after.
        </p>
      </button>
    </div>
  );
}

function PostFields({
  postType,
  playerType,
  onBack,
  onCreated,
}: {
  postType: PostType;
  playerType: PlayerType;
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  // Festivals run multi-day. Everyone else (venue, talent_buyer, record_label) is single-day.
  const isMultiDayEvent = playerType === "festival" && postType === "event";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [openUntil, setOpenUntil] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [payInfo, setPayInfo] = useState("");
  const [playerTypesWanted, setPlayerTypesWanted] = useState<PlayerType[]>([]);
  const [taggedBands, setTaggedBands] = useState<Band[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Expiry preview: use end date for festivals (post stays live until 7 days
  // after the festival ENDS, not 7 days after it starts).
  const expiryPreview = useMemo(() => {
    let base: string;
    if (postType === "event") {
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
    if (postType === "event" && !eventDate) {
      setError("Event date is required.");
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
      const { postId, error: serverError } = await createMarketplacePost({
        post_type: postType,
        title: title.trim(),
        description: description.trim(),
        event_date: postType === "event" ? eventDate : undefined,
        event_end_date:
          isMultiDayEvent && eventEndDate ? eventEndDate : undefined,
        event_location: postType === "event" ? eventLocation.trim() : undefined,
        open_until: postType === "opportunity" ? openUntil : undefined,
        genres,
        pay_info: payInfo.trim(),
        player_types_wanted: playerTypesWanted,
        tagged_band_profile_ids:
          postType === "event"
            ? taggedBands.map((b) => b.profile_id)
            : undefined,
      });

      if (serverError) {
        setError(serverError);
        return;
      }
      if (postId) onCreated(postId);
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8"
    >
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-brand-gray-400 transition hover:text-white"
        >
          ← Back to type selector
        </button>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
            postType === "event"
              ? "bg-brand-orange/20 text-brand-orange"
              : "bg-blue-500/20 text-blue-300"
          }`}
        >
          {postType === "event" ? "Event" : "Opportunity"}
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
          placeholder={
            postType === "event"
              ? "Live Music Night — Friday Headliner Slot"
              : "Looking for Austin indie bands for label showcase"
          }
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
          placeholder="Share details — vibe, expectations, what you're looking for…"
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-brand-gray-500 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
        />
        <p className="mt-1 text-right text-xs text-brand-gray-500">
          {description.length}/2000
        </p>
      </div>

      {/* Event-only fields */}
      {postType === "event" ? (
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
                  min={today}
                  onChange={(e) => {
                    setEventDate(e.target.value);
                    // Clear end date if it now precedes the new start date
                    if (eventEndDate && eventEndDate < e.target.value) {
                      setEventEndDate("");
                    }
                  }}
                  required
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  End date
                </label>
                <input
                  type="date"
                  value={eventEndDate}
                  min={eventDate || today}
                  onChange={(e) => setEventEndDate(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
                />
                <p className="mt-1 text-xs text-brand-gray-400">
                  Optional — leave blank for a single-day festival.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!isMultiDayEvent ? (
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Event date <span className="text-brand-orange">*</span>
                </label>
                <input
                  type="date"
                  value={eventDate}
                  min={today}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
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

          <BandTagPicker selected={taggedBands} onChange={setTaggedBands} />
        </>
      ) : (
        <div>
          <label className="mb-2 block text-sm font-semibold text-white">
            Open until <span className="text-brand-orange">*</span>
          </label>
          <input
            type="date"
            value={openUntil}
            min={today}
            onChange={(e) => setOpenUntil(e.target.value)}
            required
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
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

      {/* Expiration preview */}
      {expiryPreview ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-brand-gray-300">
          ⏱ This post will be automatically removed on{" "}
          <span className="font-semibold text-white">{expiryPreview}</span>.
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-brand-orange py-3 text-sm font-bold text-black transition hover:bg-brand-orange/90 disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {isPending ? "Posting…" : "Post to marketplace"}
      </button>
    </form>
  );
}
