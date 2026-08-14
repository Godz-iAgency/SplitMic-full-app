import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAuthorizedCronRequest } from "@/lib/http/cronAuth";
import { syncLiveEvents } from "@/lib/events/sync";

export const dynamic = "force-dynamic";

/**
 * Scheduled sync of Austin live-music listings from Do512 into `live_events`.
 *
 * Same shape as /api/cron/cleanup-posts: scheduler-agnostic (any service
 * that can send `Authorization: Bearer $CRON_SECRET`), fails closed if
 * CRON_SECRET is unset, so an unconfigured deploy can never expose an
 * unauthenticated write.
 *
 * vercel.json schedules this at 14:00 UTC — 9am Central Daylight Time
 * (roughly mid-March to early November) or 8am Central Standard Time the
 * rest of the year. Vercel cron schedules run in UTC with no DST awareness,
 * so a single fixed time can't track the offset change; 14:00 UTC keeps the
 * "9am" mental model correct for the majority of the year and drifts by one
 * hour during CST rather than needing a second cron entry plus a
 * day-of-year guard to solve a one-hour, twice-a-year discrepancy. The
 * "today" cycle boundary in lib/events/time.ts is fixed at 9am Chicago
 * regardless of when this actually fires — a run landing at 8am instead of
 * 9am just means the day rolls over an hour early on the days it happens.
 *
 *   GET /api/cron/sync-events              → scrape + upsert
 *   GET /api/cron/sync-events?dryRun=1     → report only, write nothing
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/sync-events] CRON_SECRET is not set — refusing");
    return NextResponse.json(
      { error: "Sync is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorizedCronRequest(request, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  const result = await syncLiveEvents(createServiceRoleClient(), { dryRun });

  if (result.error) {
    console.error("[cron/sync-events]", result.error);
    return NextResponse.json(result, { status: 502 });
  }

  console.log(
    `[cron/sync-events]${result.dryRun ? " (dry run)" : ""} scraped ${result.eventsScraped}, ` +
      `upserted ${result.eventsUpserted}, deactivated ${result.eventsDeactivated}` +
      (result.partial ? " — partial scrape, skipped deactivation" : ""),
  );

  return NextResponse.json(result);
}
