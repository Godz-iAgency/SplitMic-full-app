"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { respondToConnectionRequest } from "@/app/inbox/actions";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";
import type { IncomingRequest } from "@/lib/supabase/messaging";

export function RequestCard({ request }: { request: IncomingRequest }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "accepted" | "declined">(null);
  const [isPending, startTransition] = useTransition();

  const playerOption = PLAYER_TYPE_OPTIONS.find(
    (o) => o.value === request.requester_player_type,
  );

  function respond(decision: "accepted" | "declined") {
    setError(null);
    startTransition(async () => {
      const result = await respondToConnectionRequest(
        request.request_id,
        decision,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(decision);
      if (decision === "accepted" && result.threadId) {
        // Briefly show success, then navigate to the new thread
        setTimeout(() => router.push(`/inbox/${result.threadId}`), 800);
      }
    });
  }

  if (done === "declined") {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/5 p-5 text-center text-sm text-brand-gray-400">
        Request declined.
      </div>
    );
  }

  if (done === "accepted") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
        <p className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-300">
          <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          Connected — opening conversation…
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start gap-3">
        <Link
          href={`/profile/${request.requester_profile_id}`}
          className="shrink-0"
        >
          {request.requester_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={request.requester_avatar_url}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gray-800 text-base font-bold text-brand-orange">
              {request.requester_name.charAt(0)}
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/profile/${request.requester_profile_id}`}
              className="font-semibold text-white transition hover:text-brand-orange"
            >
              {request.requester_name}
            </Link>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-gray-300">
              {playerOption?.label ?? request.requester_player_type}
            </span>
            {request.request_type === "post_response" ? (
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
                Post response
              </span>
            ) : (
              <span className="rounded-full bg-brand-orange/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-orange">
                Connect request
              </span>
            )}
          </div>

          {request.related_post_title ? (
            <Link
              href={`/opportunities/${request.related_post_id}`}
              className="mt-1 inline-block text-xs text-brand-gray-300 underline-offset-2 hover:underline"
            >
              re: {request.related_post_title}
            </Link>
          ) : null}

          {request.message ? (
            <p className="mt-2 whitespace-pre-line text-sm text-brand-gray-200">
              {request.message}
            </p>
          ) : (
            <p className="mt-2 text-sm italic text-brand-gray-500">
              No message.
            </p>
          )}

          {error ? (
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => respond("accepted")}
              disabled={isPending}
              className="rounded-full bg-brand-orange px-5 py-1.5 text-xs font-bold text-black transition hover:bg-brand-orange/90 disabled:opacity-50"
            >
              {isPending ? "…" : "Accept"}
            </button>
            <button
              type="button"
              onClick={() => respond("declined")}
              disabled={isPending}
              className="rounded-full border border-white/15 bg-white/5 px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
