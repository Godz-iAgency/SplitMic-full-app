"use client";

import { useMemo, useState } from "react";
import type { LiveEventCard as EventCardData } from "@/lib/events/queries";
import { isToday, isUpcoming } from "@/lib/events/time";
import { matchesAllFilters, distinctValues, type FreePaid } from "@/lib/events/filters";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { EventCard } from "./EventCard";
import { EmptyState } from "./EmptyState";
import { EventFaqSection } from "./EventFaqSection";
import { BackToHomeLink } from "@/components/directory/BackToHomeLink";

type Range = "today" | "week";

const ALL_VALUE = "";

type Props = {
  /** Already fetched server-side, 7 days out — this component only filters it. */
  events: EventCardData[];
};

export function LiveEventsView({ events }: Props) {
  const [range, setRange] = useState<Range>("today");
  const [freePaid, setFreePaid] = useState<FreePaid>("all");
  const [genre, setGenre] = useState(ALL_VALUE);
  const [venue, setVenue] = useState(ALL_VALUE);

  // Options are built from the full, unfiltered event list — not from
  // `visible` below — so a dropdown's own option list doesn't shrink or
  // reorder as the user narrows other filters, which would make it look like
  // options were disappearing rather than the results.
  const genreOptions = useMemo(
    () => toDropdownOptions(distinctValues(events, (e) => e.genre), "All genres"),
    [events],
  );
  const venueOptions = useMemo(
    () => toDropdownOptions(distinctValues(events, (e) => e.venueName), "All venues"),
    [events],
  );

  // "This Week" is explicitly everything OTHER than tonight, not tonight plus
  // the rest of the week — the two tabs partition the list, they don't
  // overlap. It also excludes anything already in the past: the underlying
  // query has a 26-hour lookback so a show that's already started doesn't
  // vanish from "Tonight" mid-way through, but that same lookback leaves
  // yesterday's leftover shows in the fetched list — without the isUpcoming
  // check, those showed up under "This Week" wearing a date already gone by.
  // "Tonight" deliberately keeps already-started shows visible (isToday's
  // docstring), so isUpcoming is never applied there.
  const visible = useMemo(() => {
    const now = new Date();
    const byRange =
      range === "today"
        ? events.filter((e) => isToday(e.eventDatetime, now))
        : events.filter(
            (e) => !isToday(e.eventDatetime, now) && isUpcoming(e.eventDatetime, now),
          );

    return byRange.filter((e) => matchesAllFilters(e, { freePaid, genre, venue }));
  }, [events, range, freePaid, genre, venue]);

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <BackToHomeLink className="mb-8" />

        <header className="text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Austin Live Music</h1>
          <p className="mt-2 text-brand-gray-300">
            Real shows happening in Austin, TX — updated daily.
          </p>
        </header>

        <div className="mt-6 flex justify-center gap-2">
          <ToggleButton active={range === "today"} onClick={() => setRange("today")}>
            Tonight
          </ToggleButton>
          <ToggleButton active={range === "week"} onClick={() => setRange("week")}>
            This Week
          </ToggleButton>
        </div>

        {/* A second, narrower row below the primary Tonight/This Week
            switch — these narrow the list rather than change which list
            you're looking at, so they get the same Dropdown treatment as
            the directory's own filters (components/search/GenreFilter.tsx)
            rather than button-toggles. */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Dropdown
            value={freePaid}
            onChange={(v) => setFreePaid(v as FreePaid)}
            options={FREE_PAID_OPTIONS}
            ariaLabel="Filter by free or paid"
          />
          <Dropdown
            value={genre}
            onChange={setGenre}
            options={genreOptions}
            ariaLabel="Filter by genre"
          />
          <Dropdown
            value={venue}
            onChange={setVenue}
            options={venueOptions}
            ariaLabel="Filter by venue"
          />
        </div>

        <div className="mt-8">
          {visible.length === 0 ? (
            freePaid !== "all" || genre || venue ? (
              // A filter the user set is the reason the list is empty, not
              // lack of data — a different message from "nothing's on,"
              // since the fix here is "loosen a filter," not "check back
              // later."
              <FilteredEmptyState
                onClear={() => {
                  setFreePaid("all");
                  setGenre(ALL_VALUE);
                  setVenue(ALL_VALUE);
                }}
              />
            ) : (
              <EmptyState range={range} />
            )
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>

        <EventFaqSection />
      </div>
    </main>
  );
}

const FREE_PAID_OPTIONS: DropdownOption[] = [
  { value: "all", label: "Free & Paid" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

/** The reasoning for "why not a fixed genre taxonomy" lives with
 *  distinctValues() in lib/events/filters.ts, which computes the values
 *  this wraps into Dropdown's {value, label} shape. */
function toDropdownOptions(values: string[], allLabel: string): DropdownOption[] {
  return [{ value: ALL_VALUE, label: allLabel }, ...values.map((v) => ({ value: v, label: v }))];
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center">
      <p className="text-base font-semibold text-white">No shows match those filters</p>
      <p className="max-w-sm text-sm text-brand-gray-400">
        Try a different genre, venue, or free/paid combination.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="tappable mt-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-brand-orange hover:border-brand-orange/40"
      >
        Clear filters
      </button>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-black"
          : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-brand-gray-300 transition hover:border-brand-orange/40 hover:text-brand-orange"
      }
    >
      {children}
    </button>
  );
}
