import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAuthorizedCronRequest } from "@/lib/http/cronAuth";
import { syncTicketmasterEvents } from "@/lib/events/sync";

export const dynamic = "force-dynamic";
// Bounded by the same Vercel Hobby 60s hard kill as /api/cron/sync-events,
// even though this route is triggered externally rather than by Vercel's
// own cron — see lib/events/providers/ticketmaster.ts's TIMEOUT_MS/MAX_PAGES
// for the worst-case math this budget assumes.
export const maxDuration = 60;

/**
 * Scheduled sync of Austin Ticketmaster music events into `live_events`.
 *
 * Same auth shape as /api/cron/sync-events and /api/cron/cleanup-posts:
 * scheduler-agnostic (any caller that can send
 * `Authorization: Bearer $CRON_SECRET`), fails closed if CRON_SECRET is
 * unset.
 *
 * Unlike the Do512 sync, this one is NOT on Vercel's own cron schedule —
 * Vercel's Hobby tier caps cron jobs at once per day, and Ticketmaster
 * listings (real ticketed events with prices/availability) benefit from
 * fresher data than that. This route is meant to be triggered by an
 * external scheduler every ~4 hours instead — see
 * .github/workflows/sync-ticketmaster.yml for a ready-to-use GitHub Actions
 * version that needs only CRON_SECRET as a repo secret, no paid Vercel plan.
 *
 *   GET /api/cron/sync-ticketmaster              → fetch + upsert
 *   GET /api/cron/sync-ticketmaster?dryRun=1     → report only, write nothing
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/sync-ticketmaster] CRON_SECRET is not set — refusing");
    return NextResponse.json(
      { error: "Sync is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorizedCronRequest(request, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  const result = await syncTicketmasterEvents(createServiceRoleClient(), { dryRun });

  if (result.error) {
    console.error("[cron/sync-ticketmaster]", result.error);
    return NextResponse.json(result, { status: 502 });
  }

  console.log(
    `[cron/sync-ticketmaster]${result.dryRun ? " (dry run)" : ""} scraped ${result.eventsScraped}, ` +
      `upserted ${result.eventsUpserted}, deactivated ${result.eventsDeactivated}`,
  );

  return NextResponse.json(result);
}
