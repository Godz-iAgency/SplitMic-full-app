"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Clock, Mail, Handshake } from "lucide-react";
import { initiateConnection } from "@/app/inbox/actions";

type Props = {
  otherProfileId: string;
  /** "industry" = my account is venue/label/talent_buyer/festival (can DM direct).
   *  "band" = my account is a band (must send request). */
  myMode: "industry" | "band";
  /** Existing state between me and the other profile. */
  initialState: "none" | "pending_outbound" | "pending_inbound" | "connected";
  /** If already connected, the thread id. */
  initialThreadId: string | null;
};

export function ConnectButton({
  otherProfileId,
  myMode,
  initialState,
  initialThreadId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState(initialState);
  const [threadId, setThreadId] = useState(initialThreadId);
  const [isPending, startTransition] = useTransition();

  // Already connected → "Message" button → goes to thread
  if (state === "connected" && threadId) {
    return (
      <Link
        href={`/inbox/${threadId}`}
        className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-black tappable hover:bg-brand-orange/90"
      >
        <MessageCircle className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        Message
      </Link>
    );
  }

  // Outbound pending → waiting
  if (state === "pending_outbound") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-brand-gray-300">
        <Clock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Request sent, waiting for response
      </div>
    );
  }

  // Inbound pending → point them to inbox
  if (state === "pending_inbound") {
    return (
      <Link
        href="/inbox?tab=requests"
        className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-black tappable hover:bg-brand-orange/90"
      >
        <Mail className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        Respond to their request
      </Link>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await initiateConnection(otherProfileId, message);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.mode === "thread" && result.threadId) {
        setState("connected");
        setThreadId(result.threadId);
        router.push(`/inbox/${result.threadId}`);
      } else if (result.mode === "request") {
        setState("pending_outbound");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-black tappable hover:bg-brand-orange/90"
      >
        {myMode === "industry" ? (
          <>
            <MessageCircle className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            Send message
          </>
        ) : (
          <>
            <Handshake className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            Connect
          </>
        )}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5"
    >
      <p className="text-sm font-semibold text-white">
        {myMode === "industry"
          ? "Send a direct message"
          : "Send a Connect request"}
      </p>
      <p className="text-xs text-brand-gray-400">
        {myMode === "industry"
          ? "They'll see your message immediately and can reply."
          : "They'll review your profile and accept or decline. If accepted, a conversation opens."}
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={500}
        placeholder={
          myMode === "industry"
            ? "Hey, I came across your profile and wanted to reach out…"
            : "Hey, I'd love to connect. Here's what we're about…"
        }
        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
      />
      <p className="text-right text-xs text-brand-gray-400">
        {message.length}/500
      </p>
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-full border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white tappable hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-full bg-brand-orange py-2.5 text-sm font-bold text-black tappable hover:bg-brand-orange/90 disabled:opacity-50"
        >
          {isPending
            ? "Sending…"
            : myMode === "industry"
              ? "Send message"
              : "Send request"}
        </button>
      </div>
    </form>
  );
}
