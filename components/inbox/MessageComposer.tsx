"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/app/inbox/actions";

export function MessageComposer({ threadId }: { threadId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
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

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-white/10 bg-black/30 p-4"
    >
      {error ? (
        <p className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder="Type a message…  (Ctrl/Cmd+Enter to send)"
          className="flex-1 resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-brand-gray-500 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
        />
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="self-end rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-black transition hover:bg-brand-orange/90 disabled:opacity-50"
        >
          {isPending ? "…" : "Send"}
        </button>
      </div>
    </form>
  );
}
