"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, TriangleAlert } from "lucide-react";
import { askAssistant } from "@/app/assistant/actions";
import { AssistantResultCard } from "./AssistantResultCard";
import {
  MAX_MESSAGE_LENGTH,
  type AssistantCard,
  type AssistantTurn,
} from "@/lib/ai/assistant/contract";

type Bubble = {
  role: "user" | "assistant";
  content: string;
  cards?: AssistantCard[];
  /** Rendered as a notice rather than as the assistant's own words. */
  error?: string;
  degraded?: boolean;
};

const STARTERS = [
  "What shows are happening tonight?",
  "Find reggae bands in Austin",
  "Where can I rent a drum kit?",
  "Show me free shows this week",
];

export function AssistantChat() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, pending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    // Only prior *text* turns go back to the server — cards are display state
    // and are rebuilt from real queries on every request, never replayed.
    const history: AssistantTurn[] = bubbles
      .filter((b) => !b.error && b.content)
      .map((b) => ({ role: b.role, content: b.content }));

    setBubbles((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setPending(true);

    try {
      const response = await askAssistant(trimmed, history);
      setBubbles((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.text,
          cards: response.cards,
          error: response.error,
          degraded: response.degraded,
        },
      ]);
    } catch {
      setBubbles((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          error: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  const isEmpty = bubbles.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {isEmpty ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-orange/15 text-brand-orange">
            <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm text-brand-gray-300">
            Ask for what you need in plain English. I search real SplitMic
            members, the Austin directory, and tonight&apos;s live music.
          </p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {STARTERS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => send(s)}
                  className="tappable rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-4" aria-live="polite" aria-busy={pending}>
        {bubbles.map((bubble, i) => (
          <div key={i}>
            {bubble.role === "user" ? (
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-orange px-4 py-2.5 text-sm font-medium text-black">
                  {bubble.content}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {bubble.error ? (
                  <p className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    <TriangleAlert
                      className="mt-0.5 h-4 w-4 shrink-0"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {bubble.error}
                  </p>
                ) : null}

                {bubble.content ? (
                  <p className="max-w-[95%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                    {bubble.content}
                  </p>
                ) : null}

                {bubble.degraded ? (
                  <p className="text-xs text-brand-gray-400">
                    Answered by the backup model. Results are still real, but
                    the wording may be rougher than usual.
                  </p>
                ) : null}

                {bubble.cards && bubble.cards.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {bubble.cards.map((card) => (
                      <AssistantResultCard key={card.id} card={card} />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}

        {pending ? (
          <p className="flex items-center gap-2 text-sm text-brand-gray-400">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-brand-orange" />
            Searching SplitMic…
          </p>
        ) : null}

        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2"
      >
        <label htmlFor="assistant-input" className="sr-only">
          Ask SplitMic AI
        </label>
        <textarea
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — the convention people
            // already expect from every other chat input.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Tell SplitMic what you're looking for…"
          className="min-h-[48px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Send"
          className="tappable inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-orange text-black disabled:opacity-40"
        >
          <Send className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
