import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getUpcomingEvents } from "@/lib/events/queries";
import { LiveEventsView } from "@/components/live/LiveEventsView";
import { EventsJsonLd } from "@/components/live/EventsJsonLd";
import { FaqJsonLd } from "@/components/live/FaqJsonLd";

// Public page — no login required, same pattern as app/page.tsx. The sync
// job only runs once a day, so a 30-minute revalidate is plenty fresh.
export const revalidate = 1800;

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://splitmic.com";

export const metadata: Metadata = {
  // Root layout applies a "%s | SplitMic" template to this — no need to
  // repeat the suffix here (it doubled up before this fix).
  title: "Austin Live Music Tonight & This Week",
  description:
    "Live bands and shows happening in Austin, TX today — venue, time, and directions for every show. Updated daily.",
  alternates: { canonical: "/live" },
  openGraph: {
    title: "Austin Live Music Tonight & This Week | SplitMic",
    description:
      "Live bands and shows happening in Austin, TX today — venue, time, and directions for every show. Updated daily.",
    type: "website",
  },
};

export default async function LiveEventsPage() {
  let events: Awaited<ReturnType<typeof getUpcomingEvents>> = [];
  try {
    events = await getUpcomingEvents(createServiceRoleClient(), { rangeDays: 7 });
  } catch {
    // Missing env or query failure — page still renders with FAQ + an empty feed.
  }

  return (
    <>
      <EventsJsonLd events={events} baseUrl={SITE_URL} />
      <FaqJsonLd />
      <LiveEventsView events={events} />
    </>
  );
}
