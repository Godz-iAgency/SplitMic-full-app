"use client";

import { useState, useTransition } from "react";
import { deleteMarketplacePost } from "@/app/opportunities/actions";

export function DeletePostButton({ postId }: { postId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const { error: err } = await deleteMarketplacePost(postId);
      if (err) setError(err);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-red-400 transition hover:text-red-300"
      >
        Delete this post
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs">
      <p className="font-semibold text-red-300">Delete this post?</p>
      <p className="mt-1 text-red-200/70">This cannot be undone.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-semibold text-white tappable hover:bg-white/10 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-full bg-red-500 px-4 py-1.5 font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {isPending ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
      {error ? <p className="mt-2 text-red-300">{error}</p> : null}
    </div>
  );
}
