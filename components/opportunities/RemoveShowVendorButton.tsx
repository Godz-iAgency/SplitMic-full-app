"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeShowVendor } from "@/app/opportunities/actions";

/**
 * Takes a business off a show. Used by the show's owner on any listing, and by
 * the business on its own. Asks once before acting, like Delete post does.
 */
export function RemoveShowVendorButton({
  listingId,
  label = "Remove",
  confirmText = "Take them off this show?",
}: {
  listingId: string;
  label?: string;
  confirmText?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeShowVendor(listingId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="tappable min-h-[36px] text-xs font-medium text-red-400 hover:text-red-300"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold text-red-300">{confirmText}</span>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="tappable min-h-[32px] rounded-full border border-white/15 bg-white/5 px-3 font-semibold text-white hover:bg-white/10 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        className="tappable min-h-[32px] rounded-full bg-red-500 px-3 font-bold text-white hover:bg-red-600 disabled:opacity-50"
      >
        {isPending ? "Removing…" : "Yes, remove"}
      </button>
      {error ? <span role="alert" className="w-full text-red-300">{error}</span> : null}
    </div>
  );
}
