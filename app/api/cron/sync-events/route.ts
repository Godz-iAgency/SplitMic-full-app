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
