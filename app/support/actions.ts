"use server";

import { Resend } from "resend";

/** Where support messages are delivered. */
const SUPPORT_TO_EMAIL = "christopher@godz-iagency.com";

/**
 * Sender address. Defaults to Resend's shared sender, which delivers reliably
 * to the account owner without domain verification. Once splitmic.com is
 * verified as a sending domain in Resend, set SUPPORT_FROM_EMAIL in .env.local
 * (e.g. "SplitMic Support <support@splitmic.com>") for branded delivery.
 */
const SUPPORT_FROM_EMAIL =
  process.env.SUPPORT_FROM_EMAIL ?? "SplitMic Support <onboarding@resend.dev>";

const ALLOWED_TOPICS = new Set([
  "General question",
  "Bug report",
  "Account issue",
  "Feature request",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SupportInput = {
  name: string;
  email: string;
  topic: string;
  message: string;
  /** Honeypot — must stay empty. Bots tend to fill every field. */
  company?: string;
};

export async function sendSupportMessage(
  input: SupportInput,
): Promise<{ ok: boolean; error?: string }> {
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  const topic = input.topic?.trim() ?? "";
  const message = input.message?.trim() ?? "";

  // Honeypot: if filled, silently accept without sending (don't tip off bots).
  if (input.company && input.company.trim() !== "") {
    return { ok: true };
  }

  // Validation
  if (name.length < 2) return { ok: false, error: "Please enter your name." };
  if (!EMAIL_RE.test(email))
    return { ok: false, error: "Please enter a valid email address." };
  if (!ALLOWED_TOPICS.has(topic))
    return { ok: false, error: "Please choose a topic." };
  if (message.length < 10)
    return {
      ok: false,
      error: "Please add a bit more detail (at least 10 characters).",
    };
  if (message.length > 5000)
    return { ok: false, error: "Message is too long (5000 characters max)." };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Misconfiguration — log server-side, show a friendly message.
    console.error("[support] RESEND_API_KEY is not set");
    return {
      ok: false,
      error: "Support is temporarily unavailable. Please email us directly.",
    };
  }

  const resend = new Resend(apiKey);

  const safe = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  try {
    const { error } = await resend.emails.send({
      from: SUPPORT_FROM_EMAIL,
      to: [SUPPORT_TO_EMAIL],
      replyTo: email,
      subject: `[SplitMic Support] ${topic} (${name})`,
      text: `Topic: ${topic}\nFrom: ${name} <${email}>\n\n${message}`,
      html: `
        <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111;">
          <div style="background:#000;padding:20px 24px;border-radius:12px 12px 0 0;">
            <span style="color:#FF6B35;font-size:20px;font-weight:800;letter-spacing:-0.02em;">SPLIT</span><span style="color:#fff;font-size:20px;font-weight:800;">MIC</span>
            <div style="color:#999;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Support message</div>
          </div>
          <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:6px 0;color:#888;width:80px;">Topic</td><td style="padding:6px 0;font-weight:600;">${safe(topic)}</td></tr>
              <tr><td style="padding:6px 0;color:#888;">From</td><td style="padding:6px 0;font-weight:600;">${safe(name)}</td></tr>
              <tr><td style="padding:6px 0;color:#888;">Email</td><td style="padding:6px 0;"><a href="mailto:${safe(email)}" style="color:#FF6B35;">${safe(email)}</a></td></tr>
            </table>
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid #eee;white-space:pre-wrap;line-height:1.6;font-size:15px;">${safe(message)}</div>
            <p style="margin-top:24px;color:#aaa;font-size:12px;">Reply directly to this email to respond to ${safe(name)}.</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("[support] Resend error:", error);
      return {
        ok: false,
        error: "Couldn't send your message. Please try again in a moment.",
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("[support] Unexpected send failure:", err);
    return {
      ok: false,
      error: "Something went wrong sending your message. Please try again.",
    };
  }
}
