"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, MessageCircle, Sparkles } from "lucide-react";
import { ReadinessBadge } from "@/components/profile/ReadinessBadge";
import { initiateConnection } from "@/app/inbox/actions";
import type { MatchCard } from "@/lib/supabase/matchBands";

type Props = {
  card: MatchCard;
  /** 1-based position, shown so the ranking is legible at a glance. */
  rank: number;
};

/**
 * One band in the shortlist.
 *
 * The message box is inline rather than a link out to the profile: a buyer
 * working through a shortlist is comparing bands, and losing that list to
 * reach out to one of them is the whole friction this feature exists to remove.
 * Talent buyers are an industry type, so `initiateConnection` always opens a
 * thread directly and is safe to call again if one already exists.
 */
export function MatchResultCard({ card, rank }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const initial = card.display_name.charAt(0).toUpperCase();

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await initiateConnection(card.profile_id, message);
      if (result.error) {
        setError(result.error);
        return;
      }
      setThreadId(result.threadId ?? null);
      setSent(true);
      setOpen(false);
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-gray-900 to-black">
      <div className="h-1 w-full bg-gradient-to-r from-brand-orange via-brand-orange/60 to-transparent" />

      <div className="flex flex-1 flex-col p-5">
        {/* Avatar + name */}
        <div className="flex items-start gap-3.5">
          <div className="relative h-14 w-14 shrink-0">
            <div className="h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-brand-gray-800 to-brand-gray-900 ring-1 ring-white/10">
              {card.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.avatar_url}
                  alt={card.display_name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 text-2xl font-bold text-brand-orange">
                  {initial}
                </div>
              )}
            </div>
            <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-brand-orange/40 bg-black text-xs font-bold text-brand-orange">
              {rank}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <Link
              href={`/profile/${card.profile_id}`}
              className="line-clamp-2 text-base font-bold leading-snug text-white transition hover:text-brand-orange"
            >
              {card.display_name}
            </Link>
            <div className="mt-1.5">
              <ReadinessBadge score={card.readiness_score} />
            </div>
          </div>
        </div>

        {/* Why this band surfaced */}
        {card.reasons.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {card.reasons.map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-2 text-sm leading-relaxed text-brand-gray-200"
              >
                <Sparkles
                  className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-orange"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                {reason}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Their own words */}
        {card.one_liner ? (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-brand-gray-400">
            {card.one_liner}
          </p>
        ) : null}

        {/* Actions */}
        <div className="mt-auto pt-4">
          {sent ? (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                Message sent
              </span>
              {threadId ? (
                <Link
                  href={`/inbox/${threadId}`}
                  className="text-sm font-semibold text-brand-orange hover:underline"
                >
                  Open thread
                </Link>
              ) : null}
            </div>
          ) : open ? (
            <div className="space-y-2.5">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={500}
                autoFocus
                placeholder={`Hey ${card.display_name}, I'm booking a show and you look like a fit…`}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
              />
              {error ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-full border border-white/15 bg-white/5 py-2 text-sm font-semibold text-white tappable hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isPending || !message.trim()}
                  className="flex-1 rounded-full bg-brand-orange py-2 text-sm font-bold text-black tappable hover:bg-brand-orange/90 disabled:opacity-50"
                >
                  {isPending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-black tappable hover:bg-brand-orange/90"
              >
                <MessageCircle
                  className="h-4 w-4"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                Message
              </button>
              <Link
                href={`/profile/${card.profile_id}`}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white tappable hover:bg-white/10"
              >
                Profile
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
