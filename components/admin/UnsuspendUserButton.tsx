"use client";

import { useTransition, useState } from "react";
import { Check } from "lucide-react";
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
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
      >
        {pending ? (
          "Unsuspending..."
        ) : (
          <>
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            Unsuspend user
          </>
        )}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
