"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { adminSuspendUser } from "@/app/admin/actions";

export function SuspendUserButton({ profileId }: { profileId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await adminSuspendUser(profileId, reason);
      if (res.error) setError(res.error);
      else {
        setShowForm(false);
        setReason("");
      }
    });
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
      >
        <Ban className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        Suspend user
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-red-500/40 bg-red-500/5 p-3">
      <p className="text-xs font-semibold text-red-300">
        Reason for suspension (shown to admin only):
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="e.g. spam, off-topic posts, policy violation..."
        className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white placeholder:text-brand-gray-400 focus:border-red-400 focus:outline-none"
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="flex-1 rounded-full bg-red-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {pending ? "Suspending..." : "Confirm suspend"}
        </button>
        <button
          onClick={() => {
            setShowForm(false);
            setReason("");
            setError(null);
          }}
          disabled={pending}
          className="rounded-full border border-white/15 px-3 py-2 text-sm text-white transition hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
