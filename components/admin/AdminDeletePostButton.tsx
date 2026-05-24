"use client";

import { useState, useTransition } from "react";
import { adminDeletePost } from "@/app/admin/actions";

export function AdminDeletePostButton({
  postId,
  title,
}: {
  postId: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const res = await adminDeletePost(postId);
      if (res.error) {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <button
          onClick={go}
          disabled={pending}
          title={`Delete "${title}"`}
          className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {pending ? "Deleting..." : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white transition hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
