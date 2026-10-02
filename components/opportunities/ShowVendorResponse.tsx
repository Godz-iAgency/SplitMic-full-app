"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Wrench } from "lucide-react";
import { respondToShowVendor } from "@/app/opportunities/actions";
import type { ShowVendorStatus } from "@/lib/supabase/marketplace";
import { RemoveShowVendorButton } from "./RemoveShowVendorButton";

/**
 * What a gear or rehearsal business sees on a show it has been listed on: the
 * accept/decline ask, then (once accepted) a way to take itself back off.
 * The counterpart of BandTagActions for bands.
 */
export function ShowVendorResponse({
  listingId,
  initialStatus,
  posterName,
}: {
  listingId: string;
  initialStatus: ShowVendorStatus;
  posterName: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function respond(decision: "accepted" | "declined") {
    setError(null);
    startTransition(async () => {
      const result = await respondToShowVendor(listingId, decision);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatus(decision);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/5 p-5">
      <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-brand-orange">
        <Wrench className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        {status === "pending"
          ? `${posterName} listed you on this show`
          : "Gear & services on this show"}
      </h3>

      {status === "pending" ? (
        <>
          <p className="mt-1 text-xs text-brand-gray-300">
            Accept to appear under Gear &amp; services here and on your
            profile, so the bands and people on this show can contact you about
            it. Nothing shows publicly until you do.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => respond("accepted")}
              disabled={isPending}
              className="tappable min-h-[44px] flex-1 rounded-full bg-brand-orange text-sm font-bold text-black hover:bg-brand-orange/90 disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => respond("declined")}
              disabled={isPending}
              className="tappable min-h-[44px] flex-1 rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </>
      ) : status === "accepted" ? (
        <>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-emerald-300">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            You&apos;re listed on this show, and it&apos;s on your profile.
          </p>
          <div className="mt-2">
            <RemoveShowVendorButton
              listingId={listingId}
              label="Take me off this show"
              confirmText="Take yourself off?"
            />
          </div>
        </>
      ) : (
        <p className="mt-1 text-xs text-brand-gray-400">
          You declined. You won&apos;t appear on this show.
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
