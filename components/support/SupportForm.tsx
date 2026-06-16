"use client";

import { useState, useTransition } from "react";
import { Check, Send } from "lucide-react";
import { sendSupportMessage } from "@/app/support/actions";

const TOPICS = [
  "General question",
  "Bug report",
  "Account issue",
  "Feature request",
] as const;

type Props = {
  defaultName?: string;
  defaultEmail?: string;
};

export function SupportForm({ defaultName = "", defaultEmail = "" }: Props) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await sendSupportMessage({
        name,
        email,
        topic,
        message,
        company,
      });
      if (result.ok) {
        setSent(true);
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-brand-orange/30 bg-gradient-to-b from-brand-orange/[.08] to-transparent p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange text-white">
          <Check className="h-7 w-7" strokeWidth={3} />
        </div>
        <h2 className="text-xl font-bold text-white">Message sent</h2>
        <p className="mt-2 text-sm text-brand-gray-300">
          Thanks{name ? `, ${name.split(" ")[0]}` : ""}. We&apos;ve got your
          message and will get back to you at{" "}
          <span className="text-brand-orange">{email}</span> as soon as we can.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setMessage("");
            setTopic(TOPICS[0]);
          }}
          className="mt-6 rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Honeypot — visually hidden, off-screen, not announced */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          Company
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="support-name" className="label-text">
            Your name
          </label>
          <input
            id="support-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="input-field"
          />
        </div>
        <div>
          <label htmlFor="support-email" className="label-text">
            Email
          </label>
          <input
            id="support-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input-field"
          />
        </div>
      </div>

      <div>
        <label htmlFor="support-topic" className="label-text">
          Topic
        </label>
        <select
          id="support-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="input-field [color-scheme:dark]"
        >
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="support-message" className="label-text">
          How can we help?
        </label>
        <textarea
          id="support-message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what's going on…"
          maxLength={5000}
          className="input-field resize-y"
        />
        <p className="mt-1 text-right text-xs text-brand-gray-500">
          {message.length}/5000
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-orange px-8 py-4 text-base font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:bg-orange-600 hover:shadow-brand-orange/50 active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? (
          "Sending…"
        ) : (
          <>
            <Send className="h-4 w-4" strokeWidth={2.5} />
            Send message
          </>
        )}
      </button>

      <p className="text-center text-xs text-brand-gray-500">
        Or email us directly at{" "}
        <a
          href="mailto:christopher@godz-iagency.com"
          className="text-brand-orange hover:underline"
        >
          christopher@godz-iagency.com
        </a>
      </p>
    </form>
  );
}
