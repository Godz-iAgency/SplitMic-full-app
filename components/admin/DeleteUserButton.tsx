"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { adminDeleteUser } from "@/app/admin/actions";

export function DeleteUserButton({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const [confirm, setConfirm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (confirm !== "DELETE") {
      setError('Type DELETE in caps to confirm.');
      return;
    }
    startTransition(async () => {
      const res = await adminDeleteUser(userId);
      if (res?.error) setError(res.error);
    });
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-red-500/40 bg-transparent px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        Delete user permanently
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-red-500/60 bg-red-500/10 p-3">
      <p className="inline-flex items-start gap-1.5 text-xs font-bold text-red-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.5} aria-hidden="true" />
        <span>
          This permanently deletes <b>{displayName}</b> and all their data
          (profile, posts, messages). This cannot be undone.
        </span>
      </p>
      <p className="text-xs text-red-200">
        Type <b>DELETE</b> to confirm:
      </p>
      <input
        type="text"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white focus:border-red-400 focus:outline-none"
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="flex-1 rounded-full bg-red-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {pending ? "Deleting..." : "Confirm delete"}
        </button>
        <button
          onClick={() => {
            setShowForm(false);
            setConfirm("");
            setError(null);
          }}
          disabled={pending}
          className="rounded-full border border-white/15 px-3 py-2 text-sm text-white tappable hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
