import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Application-level usage control and the observability log behind it.
 *
 * The limit is OUR number, not a provider's. Gemini's and Groq's free tiers
 * change without notice and differ per project; hard-coding either would make
 * SplitMic's behavior depend on someone else's pricing page. This caps how
 * much any one account can consume per day so a single user can't exhaust the
 * shared quota, and it stays correct whatever the providers do.
 */

const DEFAULT_MESSAGES_PER_DAY = 50;

/** Configurable without a deploy, and safe against a garbage env value. */
export function dailyMessageLimit(): number {
  const raw = Number(process.env.FREE_AI_MESSAGES_PER_DAY);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MESSAGES_PER_DAY;
}

export type LimitCheck = {
  allowed: boolean;
  used: number;
  limit: number;
};

/**
 * Counts today's requests for one user, where "today" starts at midnight
 * Austin time — the same day boundary the rest of the product uses, so a
 * limit doesn't reset at what is lunchtime to the user.
 *
 * Counted through the *user's* client, which RLS restricts to their own rows
 * (migrations/step19_ai_assistant.sql). A failed count returns `allowed` so a
 * database hiccup degrades to letting the request through rather than locking
 * everyone out — the limit is a guardrail against runaway cost, not a
 * security control, and failing it closed would be the worse trade.
 */
export async function checkDailyLimit(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<LimitCheck> {
  const limit = dailyMessageLimit();

  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", austinMidnightUtc(now).toISOString());

  if (error) return { allowed: true, used: 0, limit };

  const used = count ?? 0;
  return { allowed: used < limit, used, limit };
}

/**
 * Start of the current Austin day, as a UTC instant. Derived from the zone's
 * own offset for that date rather than a fixed -5/-6 so it stays correct
 * across DST.
 */
function austinMidnightUtc(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const offsetHours = austinOffsetHours(now);
  return new Date(`${parts}T00:00:00${formatOffset(offsetHours)}`);
}

function austinOffsetHours(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date).find((p) => p.type === "hour")?.value;

  const utcHour = date.getUTCHours();
  const local = hour ? Number(hour) : utcHour;
  // Wraps across the date line: local 19:00 against UTC 01:00 is -6, not +18.
  let diff = local - utcHour;
  if (diff > 12) diff -= 24;
  if (diff < -12) diff += 24;
  return diff;
}

function formatOffset(hours: number): string {
  const sign = hours <= 0 ? "-" : "+";
  const abs = Math.abs(hours).toString().padStart(2, "0");
  return `${sign}${abs}:00`;
}

export type UsageRecord = {
  userId: string;
  provider: string;
  model: string;
  fellBack: boolean;
  toolCalls: number;
  resultCount: number;
  latencyMs: number;
  error?: string;
};

/**
 * Writes one usage row. Service-role because there is deliberately no INSERT
 * policy on the table — a user who could write their own usage rows could also
 * delete them and reset their limit.
 *
 * Never throws and never blocks the reply: a logging failure must not turn a
 * good answer into an error. This is the "a non-critical notification failure
 * must not corrupt the primary transaction" rule applied to telemetry.
 */
export async function recordUsage(
  serviceClient: SupabaseClient,
  record: UsageRecord,
): Promise<void> {
  try {
    const { error } = await serviceClient.from("ai_usage_events").insert({
      user_id: record.userId,
      provider: record.provider,
      model: record.model,
      fell_back: record.fellBack,
      tool_calls: record.toolCalls,
      result_count: record.resultCount,
      latency_ms: record.latencyMs,
      error: record.error ?? null,
    });
    if (error) console.error("[ai-usage] insert failed:", error.message);
  } catch (err) {
    console.error("[ai-usage] insert threw:", err);
  }
}
