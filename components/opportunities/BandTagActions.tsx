"use client";

import { useState, useTransition } from "react";
import { Tag, Check, Repeat2 } from "lucide-react";
import {
  respondToBandTag,
  toggleShareTaggedEvent,
} from "@/app/opportunities/actions";

type Props = {
  tagId: string;
  initialStatus: "pending" | "accepted" | "declined";
  initialShared: boolean;
};

export function BandTagActions({
  tagId,
  initialStatus,
  initialShared,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [shared, setShared] = useState(initialShared);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function respond(decision: "accepted" | "declined") {
    setError(null);
    startTransition(async () => {
      const { error: err } = await respondToBandTag(tagId, decision);
      if (err) setError(err);
      else setStatus(decision);
    });
  }

  function toggleShare() {
    setError(null);
    const next = !shared;
    startTransition(async () => {
      const { error: err } = await toggleShareTaggedEvent(tagId, next);
      if (err) setError(err);
      else setShared(next);
    });
  }

  return (
    <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/5 p-5">
      <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-brand-orange">
        <Tag className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        You&apos;re tagged on this event
      </h3>

      {status === "pending" ? (
        <>
          <p className="mt-1 text-xs text-brand-gray-300">
            Accept to add this event to your profile under Upcoming Shows.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => respond("accepted")}
              disabled={isPending}
              className="flex-1 rounded-full bg-brand-orange py-2 text-sm font-bold text-black tappable hover:bg-brand-orange/90 disabled:opacity-50"
            >
              Accept tag
            </button>
            <button
              type="button"
              onClick={() => respond("declined")}
              disabled={isPending}
              className="flex-1 rounded-full border border-white/15 bg-white/5 py-2 text-sm font-semibold text-white tappable hover:bg-white/10 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </>
      ) : status === "accepted" ? (
        <>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-emerald-300">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            Tag accepted. This event shows on your profile.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={toggleShare}
              disabled={isPending}
              className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition disabled:opacity-50 ${
                shared
                  ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                  : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              {shared ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                  Shared to your feed, tap to unshare
                </>
              ) : (
                <>
                  <Repeat2 className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                  Share this event to your feed
                </>
              )}
            </button>
            <p className="mt-2 text-xs text-brand-gray-400">
              Sharing puts the venue&apos;s post into the marketplace feed
              attributed to you, so your followers see it.
            </p>
          </div>
        </>
      ) : (
        <p className="mt-1 text-xs text-brand-gray-400">
          You declined this tag.
        </p>
      )}

      {error ? (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
