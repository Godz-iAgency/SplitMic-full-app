"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { respondToPost } from "@/app/opportunities/actions";

type Props = {
  postId: string;
  alreadyResponded: boolean;
  isOwnPost: boolean;
};

export function RespondPanel({ postId, alreadyResponded, isOwnPost }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isOwnPost) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-brand-gray-300">
        This is your post.
      </div>
    );
  }

  if (alreadyResponded || submitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
        <p className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-300">
          <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          Response sent
        </p>
        <p className="mt-1 text-xs text-emerald-200/70">
          The poster will review your request. You&apos;ll be notified when
          they respond.
        </p>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { error: err } = await respondToPost(postId, message);
      if (err) {
        setError(err);
        return;
      }
      setSubmitted(true);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-full bg-brand-orange py-3 text-sm font-bold text-black tappable hover:bg-brand-orange/90"
      >
        I&apos;m interested
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5"
    >
      <div>
        <label className="mb-2 block text-sm font-semibold text-white">
          Your message (optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Hey, we'd love to play this slot. Here's a quick intro…"
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
        />
        <p className="mt-1 text-right text-xs text-brand-gray-400">
          {message.length}/500
        </p>
      </div>

      <p className="text-xs text-brand-gray-400">
        This sends the poster a connection request. They&apos;ll review your
        profile and accept or decline. If accepted, a conversation opens.
      </p>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-full border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white tappable hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-full bg-brand-orange py-2.5 text-sm font-bold text-black tappable hover:bg-brand-orange/90 disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}
