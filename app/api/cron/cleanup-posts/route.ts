import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  cleanupExpiredPosts,
  DEFAULT_RETENTION_DAYS,
} from "@/lib/supabase/maintenance";

export const dynamic = "force-dynamic";

/**
 * Scheduled cleanup of long-expired marketplace posts.
 *
 * Deliberately scheduler-agnostic: any cron service that can send a GET with an
 * `Authorization: Bearer <CRON_SECRET>` header works (Vercel Cron sends exactly
 * that shape automatically). Nothing here depends on a particular host.
 *
 *   GET /api/cron/cleanup-posts              → delete
 *   GET /api/cron/cleanup-posts?dryRun=1     → report only, delete nothing
 *   GET /api/cron/cleanup-posts?retentionDays=730
 *
 * Fails closed: with no CRON_SECRET configured the endpoint refuses to run at
 * all, so an unconfigured deploy can never expose an unauthenticated delete.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/cleanup-posts] CRON_SECRET is not set — refusing");
    return NextResponse.json(
      { error: "Cleanup is not configured." },
      { status: 503 },
    );
  }

  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!provided || !secretsMatch(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const dryRun = params.get("dryRun") === "1";
  const retentionDays = Number(
    params.get("retentionDays") ?? DEFAULT_RETENTION_DAYS,
  );

  const result = await cleanupExpiredPosts(createServiceRoleClient(), {
    retentionDays,
    dryRun,
  });

  if (result.error) {
    console.error("[cron/cleanup-posts]", result.error);
    return NextResponse.json(result, { status: 500 });
  }

  // Logged so a scheduler's run history shows what each pass actually removed.
  console.log(
    `[cron/cleanup-posts]${result.dryRun ? " (dry run)" : ""} cutoff ${result.cutoffDate}: ` +
      `${result.postsDeleted} posts, ${result.eventTagsRemoved} event tags, ` +
      `${result.openMicSignupsRemoved} open mic signups` +
      (result.moreRemaining ? " — more remaining, will continue next run" : ""),
  );

  return NextResponse.json(result);
}

/** Constant-time compare so a wrong secret can't be guessed by timing. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
