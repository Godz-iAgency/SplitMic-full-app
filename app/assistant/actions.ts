"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { runAssistant } from "@/lib/ai/assistant/runAssistant";
import { checkDailyLimit, recordUsage } from "@/lib/ai/assistant/usage";
import {
  EMPTY_RESPONSE,
  MAX_MESSAGE_LENGTH,
  type AssistantResponse,
  type AssistantTurn,
} from "@/lib/ai/assistant/contract";

/**
 * The assistant's single entry point.
 *
 * A server action is a public endpoint, so authentication and the usage limit
 * are enforced here rather than trusted from the page that renders the UI —
 * the page gate only decides what gets drawn.
 *
 * Every tool query downstream runs on the *user-scoped* client created here,
 * so RLS and the directory's column grants apply to the AI exactly as they do
 * to the rest of the app. The service-role client is created only to write the
 * usage row, and never reaches the tool layer.
 */
export async function askAssistant(
  message: string,
  history: AssistantTurn[] = [],
): Promise<AssistantResponse> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ...EMPTY_RESPONSE, error: "Please sign in to use SplitMic AI." };
  }

  const trimmed = message.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed) {
    return { ...EMPTY_RESPONSE, error: "Ask me something to get started." };
  }

  const limit = await checkDailyLimit(supabase, user.id);
  if (!limit.allowed) {
    return {
      ...EMPTY_RESPONSE,
      error: `You've reached today's limit of ${limit.limit} questions. It resets at midnight.`,
    };
  }

  // Player type personalizes phrasing only — it never widens what the user can
  // see, which RLS decides independently.
  const { profile } = await getOnboardingStatus(supabase, user.id);

  const startedAt = Date.now();
  const result = await runAssistant({
    supabase,
    viewerPlayerType: profile?.player_type ?? null,
    history,
    message: trimmed,
  });

  // Telemetry must never take down a good answer, so this is fire-and-forget
  // against its own client and swallows its own failures (see usage.ts).
  void recordUsage(createServiceRoleClient(), {
    userId: user.id,
    provider: result.telemetry.provider,
    model: result.telemetry.model,
    fellBack: result.telemetry.fellBack,
    toolCalls: result.telemetry.toolCalls,
    resultCount: result.telemetry.resultCount,
    latencyMs: Date.now() - startedAt,
    error: result.telemetry.error,
  });

  return {
    text: result.text,
    cards: result.cards,
    error: result.error,
    degraded: result.degraded,
  };
}
