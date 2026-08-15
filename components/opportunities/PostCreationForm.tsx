"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mic, Briefcase, Music2 } from "lucide-react";
import { createMarketplacePost } from "@/app/opportunities/actions";
import { GenreMultiSelect } from "./GenreMultiSelect";
import { PlayerTypeMultiSelect } from "./PlayerTypeMultiSelect";
import { BandTagPicker } from "./BandTagPicker";
import type { PlayerType } from "@/lib/types";

type PostType = "event" | "opportunity" | "open_mic";

type Band = {
  profile_id: string;
  band_name: string;
  avatar_url: string | null;
};

type Props = {
  canPostEvents: boolean;
  canPostOpenMic: boolean;
  playerType: PlayerType;
  /** Venue display name — used to pre-fill the open mic title. */
  posterName?: string;
};

// Smart default: bookings cluster on Fridays, so pre-fill the next one.
// Local date math (not toISOString) so late-night posting doesn't skip a day.
function nextFriday(): string {
  const d = new Date();
  let add = (5 - d.getDay() + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function PostCreationForm({
  canPostEvents,
  canPostOpenMic,
  playerType,
  posterName,
}: Props) {
  const router = useRouter();
  const [postType, setPostType] = useState<PostType | null>(null);

  return (
    <>
      {!postType ? (
        <PostTypeChooser
          canPostEvents={canPostEvents}
          canPostOpenMic={canPostOpenMic}
          onPick={setPostType}
        />
      ) : (
        <PostFields
          key={postType}
          postType={postType}
          playerType={playerType}
          posterName={posterName}
          onBack={() => setPostType(null)}
          onCreated={(id) => router.push(`/opportunities/${id}`)}
        />
      )}
    </>
  );
}

function PostTypeChooser({
  canPostEvents,
  canPostOpenMic,
  onPick,
}: {
  canPostEvents: boolean;
  canPostOpenMic: boolean;
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
          An ongoing need: A&amp;R search, casting, collaboration, callout.
        </p>
        <p className="mt-3 text-xs text-brand-gray-400">
          You set the deadline. Removes 7 days after.
        </p>
      </button>

      {canPostOpenMic ? (
        <button
          type="button"
          onClick={() => onPick("open_mic")}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-purple-400/50 hover:bg-white/10"
        >
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/15 text-purple-300">
            <Music2 className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </div>
          <h3 className="text-lg font-bold text-white">Post an Open Mic</h3>
          <p className="mt-1 text-sm text-brand-gray-300">
            One post replaces the clipboard, the group chat, and the night-of
            chaos. Bands sign up, you run the order.
          </p>
          <p className="mt-3 text-xs text-brand-gray-400">
            Stays up until 7 days after the date.
          </p>
        </button>
      ) : null}
    </div>
  );
}

function PostFields({
  postType,
  playerType,
  posterName,
  onBack,
  onCreated,
}: {
  postType: PostType;
  playerType: PlayerType;
  posterName?: string;
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const isEvent = postType === "event";
  const isOpenMic = postType === "open_mic";
  // Events and open mics are both anchored to a specific date + location.
  const isDateBased = isEvent || isOpenMic;
  // Festivals run multi-day. Everyone else (venue, talent_buyer, record_label) is single-day.
  const isMultiDayEvent = playerType === "festival" && postType === "event";

  // Smart defaults — pre-filled so the task is scan-and-adjust, not compose.
  const [title, setTitle] = useState(
    isOpenMic && posterName ? `${posterName} Open Mic` : "",
  );
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(isDateBased ? nextFriday() : "");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [openUntil, setOpenUntil] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [payInfo, setPayInfo] = useState("");
  // Events/open mics are posted to book bands ~always — pre-select them.
  const [playerTypesWanted, setPlayerTypesWanted] = useState<PlayerType[]>(
    isDateBased ? ["band"] : [],
  );
  const [taggedBands, setTaggedBands] = useState<Band[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Expiry preview: use end date for festivals (post stays live until 7 days
  // after the festival ENDS, not 7 days after it starts).
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
      const { postId, error: serverError } = await createMarketplacePost({
        post_type: postType,
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
        tagged_band_profile_ids: isEvent
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
            isEvent
              ? "bg-brand-orange/20 text-brand-orange"
              : isOpenMic
                ? "bg-purple-500/20 text-purple-300"
                : "bg-blue-500/20 text-blue-300"
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
          placeholder={
            isEvent
              ? "Live Music Night: Friday Headliner Slot"
              : isOpenMic
                ? "Tuesday Night Open Mic"
                : "Looking for Austin indie bands for label showcase"
          }
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
        />
        <p className="mt-1 text-right text-xs text-brand-gray-400">
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
          placeholder="Share details: vibe, expectations, what you're looking for…"
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
        />
        <p className="mt-1 text-right text-xs text-brand-gray-400">
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
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
              />
            </div>
          </div>

          {isEvent ? (
            <BandTagPicker selected={taggedBands} onChange={setTaggedBands} />
          ) : null}
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
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
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
