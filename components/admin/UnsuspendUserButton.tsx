"use client";

import { useTransition, useState } from "react";
import { adminUnsuspendUser } from "@/app/admin/actions";

export function UnsuspendUserButton({ profileId }: { profileId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const res = await adminUnsuspendUser(profileId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={pending}
        className="w-full rounded-full bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
      >
        {pending ? "Unsuspending..." : "✓ Unsuspend user"}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
