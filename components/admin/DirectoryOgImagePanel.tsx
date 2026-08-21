"use client";

import { useState, useTransition } from "react";
import { ImageIcon } from "lucide-react";
import {
  adminBackfillOgImages,
  adminResetFailedOgImages,
} from "@/app/admin/directory/actions";
import type { OgImageJobResult } from "@/lib/directory/ogImageJob";

const BATCH_OPTIONS = [10, 25, 50, 100];

type Props = {
  /** Listings with a found preview photo. */
  done: number;
  /** Listings never checked. */
  pending: number;
  failed: number;
};

/**
 * Runs the free Open Graph image backfill in bounded batches.
 *
 * No API key, no billing — this just reads a meta tag off each business's own
 * website. Still batched (rather than one huge run) so an admin click has a
 * predictable, bounded runtime.
 */
export function DirectoryOgImagePanel({ done, pending, failed }: Props) {
  const [busy, startTransition] = useTransition();
  const [batch, setBatch] = useState(25);
  const [result, setResult] = useState<OgImageJobResult | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  function run() {
    setResult(null);
    setResetMsg(null);
    startTransition(async () => {
      setResult(await adminBackfillOgImages({ limit: batch }));
    });
  }

  function retryFailed() {
    setResult(null);
    setResetMsg(null);
    startTransition(async () => {
      const res = await adminResetFailedOgImages();
      setResetMsg(
        res.error
          ? res.error
          : `${res.reset} failed ${res.reset === 1 ? "listing" : "listings"} queued to retry. Run a batch to pick them up.`,
      );
    });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-bold text-white">
            <ImageIcon className="h-4 w-4 text-brand-orange" aria-hidden="true" />
            Listing photos (free)
          </h2>
          <p className="mt-1 text-sm text-brand-gray-300">
            {done} found · {pending} waiting
            {failed > 0 ? ` · ${failed} failed` : ""}. Pulls each business's own
            website preview photo, no API key, no cost. Safe to stop and
            continue later.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="og-image-batch">
            Batch size
          </label>
          <select
            id="og-image-batch"
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value))}
            className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm font-semibold text-white focus:border-brand-orange/50 focus:outline-none"
          >
            {BATCH_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} at a time
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={run}
            disabled={busy || pending === 0}
            className="rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-black tappable hover:bg-brand-orange/90 disabled:opacity-50"
          >
            {busy ? "Fetching…" : "Find photos"}
          </button>

          {failed > 0 ? (
            <button
              type="button"
              onClick={retryFailed}
              disabled={busy}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white tappable hover:bg-white/10 disabled:opacity-50"
            >
              Retry failed
            </button>
          ) : null}
        </div>
      </div>

      {busy ? (
        <p className="mt-3 text-sm text-brand-gray-400">
          Checking up to {batch} sites. This takes a few seconds each, leave
          the page open.
        </p>
      ) : null}

      {resetMsg ? (
        <p className="mt-3 text-sm text-brand-gray-300">{resetMsg}</p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/30 p-4">
          {result.error ? (
            <p className="text-sm font-semibold text-red-300">{result.error}</p>
          ) : (
            <p className="text-sm font-semibold text-emerald-300">
              {result.found} found, {result.noImage} had no photo,{" "}
              {result.failed} failed, {result.skipped} skipped (no website).{" "}
              {Math.max(0, result.remainingBefore - result.attempted)} still
              waiting.
            </p>
          )}

          {result.failures.length > 0 ? (
            <ul className="space-y-0.5 text-xs text-brand-gray-400">
              {result.failures.slice(0, 10).map((f) => (
                <li key={f.businessName}>
                  <span className="text-brand-gray-300">{f.businessName}</span>:{" "}
                  {f.reason}
                </li>
              ))}
              {result.failures.length > 10 ? (
                <li>…and {result.failures.length - 10} more.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
