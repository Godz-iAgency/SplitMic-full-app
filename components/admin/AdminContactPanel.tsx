"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Mail, Check } from "lucide-react";
import {
  adminSendInAppMessage,
  adminLogEmailSent,
} from "@/app/admin/actions";

export function AdminContactPanel({
  userId,
  profileId,
  email,
  displayName,
}: {
  userId: string;
  profileId: string;
  email: string | null;
  displayName: string;
}) {
  const [mode, setMode] = useState<"none" | "message" | "email">("none");

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-gray-400">
        Contact {displayName}
      </p>

      {mode === "none" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("message")}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-orange px-3 py-2 text-xs font-bold text-black transition hover:bg-brand-orange/90"
          >
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            Send in-app message
          </button>
          <button
            onClick={() => setMode("email")}
            disabled={!email}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-40"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            Send email
          </button>
        </div>
      )}

      {mode === "message" && (
        <InAppMessageForm
          profileId={profileId}
          onDone={() => setMode("none")}
        />
      )}

      {mode === "email" && email && (
        <EmailForm
          userId={userId}
          email={email}
          displayName={displayName}
          onDone={() => setMode("none")}
        />
      )}
    </div>
  );
}

function InAppMessageForm({
  profileId,
  onDone,
}: {
  profileId: string;
  onDone: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await adminSendInAppMessage(profileId, body);
      if (res.error) setError(res.error);
      else {
        setSuccess(true);
        setBody("");
        setTimeout(() => {
          setSuccess(false);
          onDone();
        }, 1500);
      }
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Your in-app message..."
        className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange focus:outline-none"
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      {success && (
        <p className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          Message sent.
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending || !body.trim()}
          className="flex-1 rounded-full bg-brand-orange px-3 py-2 text-xs font-bold text-black transition hover:bg-brand-orange/90 disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send message"}
        </button>
        <button
          onClick={onDone}
          disabled={pending}
          className="rounded-full border border-white/15 px-3 py-2 text-xs text-white transition hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EmailForm({
  userId,
  email,
  displayName,
  onDone,
}: {
  userId: string;
  email: string;
  displayName: string;
  onDone: () => void;
}) {
  const [subject, setSubject] = useState("");
  // Pre-fill the body with a friendly greeting using the user's display name.
  const [bodyText, setBodyText] = useState(`Hi ${displayName},\n\n`);
  const [pending, startTransition] = useTransition();

  function openMail() {
    // Open Gmail compose in a new tab, pre-filled.
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: email,
      su: subject || "Message from SplitMic",
      body: bodyText,
    });
    window.open(
      `https://mail.google.com/mail/?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
    // log it
    startTransition(async () => {
      await adminLogEmailSent(userId, subject || "(no subject)");
      onDone();
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-brand-gray-300">
        To: <span className="text-white">{displayName}</span> &lt;{email}&gt;
      </p>
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange focus:outline-none"
      />
      <textarea
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        rows={4}
        placeholder="Email body..."
        className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange focus:outline-none"
      />
      <p className="text-xs text-brand-gray-400">
        Opens Gmail in a new tab, pre-filled. We log that an email was sent
        (subject only).
      </p>
      <div className="flex gap-2">
        <button
          onClick={openMail}
          disabled={pending}
          className="flex-1 rounded-full bg-brand-orange px-3 py-2 text-xs font-bold text-black transition hover:bg-brand-orange/90 disabled:opacity-50"
        >
          Open in Gmail
        </button>
        <button
          onClick={onDone}
          disabled={pending}
          className="rounded-full border border-white/15 px-3 py-2 text-xs text-white transition hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
