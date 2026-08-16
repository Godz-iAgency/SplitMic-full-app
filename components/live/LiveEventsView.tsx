"use client";

import { useMemo, useState } from "react";
import type { LiveEventCard as EventCardData } from "@/lib/events/queries";
import { isToday, isUpcoming } from "@/lib/events/time";
import { EventCard } from "./EventCard";
import { EmptyState } from "./EmptyState";
import { EventFaqSection } from "./EventFaqSection";
import { BackToHomeLink } from "@/components/directory/BackToHomeLink";

type Range = "today" | "week";

type Props = {
  /** Already fetched server-side, 7 days out — this component only filters it. */
  events: EventCardData[];
};

export function LiveEventsView({ events }: Props) {
  const [range, setRange] = useState<Range>("today");

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
    return range === "today"
      ? events.filter((e) => isToday(e.eventDatetime, now))
      : events.filter(
          (e) => !isToday(e.eventDatetime, now) && isUpcoming(e.eventDatetime, now),
        );
  }, [events, range]);

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

        <div className="mt-8">
          {visible.length === 0 ? (
            <EmptyState range={range} />
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
