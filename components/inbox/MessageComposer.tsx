"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/app/inbox/actions";

export function MessageComposer({ threadId }: { threadId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function send() {
    if (!body.trim() || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await sendMessage(threadId, body);
      if (result.error) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-white/10 bg-black/30 p-3 sm:p-4"
    >
      {error ? (
        <p className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
          {error}
        </p>
      ) : null}
      {/* min-w-0 on the textarea is essential: without it the flex item's
          intrinsic width pushes the Send button off-screen on narrow phones. */}
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter inserts a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Type a message…"
          className="min-w-0 flex-1 resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-brand-gray-500 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
        />
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="shrink-0 rounded-full bg-brand-orange px-4 py-2.5 text-sm font-bold text-black transition hover:bg-brand-orange/90 disabled:opacity-50 sm:px-5"
        >
          {isPending ? "…" : "Send"}
        </button>
      </div>
    </form>
  );
}
