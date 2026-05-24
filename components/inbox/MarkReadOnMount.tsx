"use client";

import { useEffect } from "react";
import { markThreadRead } from "@/app/inbox/actions";

/** Fires a server action once on mount to mark messages in this thread as read. */
export function MarkReadOnMount({ threadId }: { threadId: string }) {
  useEffect(() => {
    markThreadRead(threadId).catch(() => {
      // silently ignore — non-critical
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  return null;
}
