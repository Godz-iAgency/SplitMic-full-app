"use client";

import { useTransition, useState } from "react";
import { adminTogglePublish } from "@/app/admin/actions";

export function TogglePublishButton({
  profileId,
  currentlyPublished,
}: {
  profileId: string;
  currentlyPublished: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const res = await adminTogglePublish(profileId, !currentlyPublished);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={pending}
        className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        {pending
          ? "Updating..."
          : currentlyPublished
            ? "Force unpublish"
            : "Force publish"}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
