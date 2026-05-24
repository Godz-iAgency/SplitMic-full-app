"use client";

import { useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { PasswordInput } from "./PasswordInput";

export function EmailSignUpForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClientSupabaseClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      setSentTo(email.trim());
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-5 text-center">
        <p className="text-2xl">📧</p>
        <h3 className="mt-2 text-lg font-bold text-white">Check your email</h3>
        <p className="mt-2 text-sm text-brand-gray-200">
          We sent a confirmation link to <b>{sentTo}</b>. Click it to verify
          your account and continue.
        </p>
        <p className="mt-3 text-xs text-brand-gray-300">
          Didn&apos;t get it? Check your spam folder or try again in a minute.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-left">
      <div>
        <label className="mb-1 block text-xs font-semibold text-brand-gray-300">
          Full name
        </label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Doe"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange focus:outline-none"
        />
      </div>
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
      <div>
        <label className="mb-1 block text-xs font-semibold text-brand-gray-300">
          Password
        </label>
        <PasswordInput
          required
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-brand-gray-300">
          Confirm password
        </label>
        <PasswordInput
          required
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Re-enter password"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
