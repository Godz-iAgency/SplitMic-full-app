import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { PlayerType } from "@/lib/types";

/**
 * Transactional email notifications, sent directly via Resend.
 *
 * This replaces the old Supabase Database Webhook → n8n → Gmail pipeline.
 * Every function here is BEST-EFFORT: it never throws and never blocks the
 * in-app action that triggered it. If email is misconfigured or the send
 * fails, the DM / connection request still succeeds and the user still sees
 * the in-app notification.
 *
 * DELIVERY NOTE: until splitmic.com is verified as a sending domain in Resend,
 * set NOTIFY_FROM_EMAIL to a verified address (or leave the default, which only
 * reliably delivers to the Resend account owner's own inbox). Once the domain
 * is verified, set NOTIFY_FROM_EMAIL="SplitMic <notify@splitmic.com>" in the
 * environment and user-facing delivery turns on with no code change.
 */

const FROM_EMAIL =
  process.env.NOTIFY_FROM_EMAIL ?? "SplitMic <onboarding@resend.dev>";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://splitmic.com"
).replace(/\/$/, "");

export type NotifyKind = "connection_request" | "post_response" | "message";

// Which detail table + column holds the display name for each player type.
const NAME_SOURCE: Record<PlayerType, { table: string; column: string }> = {
  band: { table: "band_details", column: "band_name" },
  venue: { table: "venue_details", column: "venue_name" },
  talent_buyer: { table: "talent_buyer_details", column: "company_name" },
  record_label: { table: "record_label_details", column: "label_name" },
  festival: { table: "festival_details", column: "festival_name" },
};

export async function notifyByEmail(params: {
  recipientUserId: string;
  senderProfileId: string;
  kind: NotifyKind;
  postTitle?: string | null;
  messagePreview?: string | null;
}): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[notify] RESEND_API_KEY not set — skipping email");
      return;
    }

    const admin = createServiceRoleClient();

    // Recipient email (RLS-bypassing read of the users mirror table)
    const { data: recipient } = await admin
      .from("users")
      .select("email")
      .eq("id", params.recipientUserId)
      .maybeSingle();
    const to = recipient?.email;
    if (!to) return;

    const senderName = await resolveProfileName(admin, params.senderProfileId);
    const content = buildContent(
      params.kind,
      senderName,
      params.postTitle ?? null,
      params.messagePreview ?? null,
    );

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: content.subject,
      text: `${content.heading}\n\n${content.line}\n\nOpen SplitMic: ${APP_URL}/inbox`,
      html: renderHtml(content.heading, content.line),
    });
    if (error) console.error("[notify] Resend error:", error);
  } catch (err) {
    // Best-effort — swallow so the triggering action never fails on email.
    console.error("[notify] send failed:", err);
  }
}

async function resolveProfileName(
  admin: SupabaseClient,
  profileId: string,
): Promise<string> {
  const { data: prof } = await admin
    .from("profiles")
    .select("player_type")
    .eq("id", profileId)
    .maybeSingle();
  const pt = prof?.player_type as PlayerType | undefined;
  if (!pt || !NAME_SOURCE[pt]) return "An Austin player";

  const { table, column } = NAME_SOURCE[pt];
  const { data } = await admin
    .from(table)
    .select(column)
    .eq("profile_id", profileId)
    .maybeSingle();
  const name = (data as Record<string, string> | null)?.[column];
  return name?.trim() || "An Austin player";
}

function buildContent(
  kind: NotifyKind,
  senderName: string,
  postTitle: string | null,
  messagePreview: string | null,
): { subject: string; heading: string; line: string } {
  switch (kind) {
    case "connection_request":
      return {
        subject: "New connection request on SplitMic",
        heading: `${senderName} wants to connect`,
        line: "They sent you a connection request. Open your inbox to accept or decline.",
      };
    case "post_response":
      return {
        subject: "Someone responded to your post",
        heading: `${senderName} responded to your post`,
        line: postTitle
          ? `Re: "${postTitle}". Open your inbox to respond.`
          : "Open your inbox to respond.",
      };
    case "message":
    default:
      return {
        subject: "New message on SplitMic",
        heading: `New message from ${senderName}`,
        line: messagePreview
          ? `"${truncate(messagePreview, 140)}"`
          : "Open your inbox to read and reply.",
      };
  }
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderHtml(heading: string, line: string): string {
  return `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;color:#111;">
      <div style="background:#000;padding:20px 24px;border-radius:12px 12px 0 0;">
        <span style="color:#FF6B35;font-size:20px;font-weight:800;letter-spacing:-0.02em;">SPLIT</span><span style="color:#fff;font-size:20px;font-weight:800;">MIC</span>
      </div>
      <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
        <h1 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111;">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#444;">${escapeHtml(line)}</p>
        <a href="${APP_URL}/inbox" style="display:inline-block;background:#FF6B35;color:#000;font-weight:700;font-size:14px;text-decoration:none;padding:11px 22px;border-radius:9999px;">Open SplitMic</a>
        <p style="margin:24px 0 0;color:#aaa;font-size:12px;">You're receiving this because you have a SplitMic account.</p>
      </div>
    </div>
  `;
}
