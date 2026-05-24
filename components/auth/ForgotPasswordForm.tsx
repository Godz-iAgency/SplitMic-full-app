"use client";

import { useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClientSupabaseClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );
      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }
      setSent(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-5 text-center">
        <p className="text-2xl">📧</p>
        <h3 className="mt-2 text-lg font-bold text-white">Check your email</h3>
        <p className="mt-2 text-sm text-brand-gray-200">
          If an account exists for <b>{email}</b>, we&apos;ve sent a password
          reset link.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-left">
      <div>
        <label className="mb-1 block text-xs font-semibold text-brand-gray-300">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange focus:outline-none"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
