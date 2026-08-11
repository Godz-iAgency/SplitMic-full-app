"use client";

import { useState, useTransition } from "react";
import { MapPin } from "lucide-react";
import {
  adminBackfillPlacePhotos,
  adminResetFailedPlaces,
} from "@/app/admin/directory/actions";
import type { PlacesJobResult } from "@/lib/directory/placesJob";

const BATCH_OPTIONS = [10, 25, 50, 100];

type Props = {
  withPhoto: number;
  pending: number;
  notFound: number;
  failed: number;
};

/**
 * Pulls each listing's real Google Maps photo. Runs in bounded batches because
 * every attempt is a billed Places lookup — the spend should always be a
 * deliberate click with a visible size, never one job that drains the quota.
 */
export function DirectoryPlacesPanel({
  withPhoto,
  pending,
  notFound,
  failed,
}: Props) {
  const [busy, startTransition] = useTransition();
  const [batch, setBatch] = useState(25);
  const [result, setResult] = useState<PlacesJobResult | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  function run() {
    setResult(null);
    setResetMsg(null);
    startTransition(async () => {
      setResult(await adminBackfillPlacePhotos({ limit: batch }));
    });
  }

  function retryFailed() {
    setResult(null);
    setResetMsg(null);
    startTransition(async () => {
      const res = await adminResetFailedPlaces();
      setResetMsg(
        res.error
          ? res.error
          : `${res.reset} failed ${res.reset === 1 ? "lookup" : "lookups"} queued to retry.`,
      );
    });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-bold text-white">
            <MapPin className="h-4 w-4 text-brand-orange" aria-hidden="true" />
            Venue photos from Google
          </h2>
          <p className="mt-1 text-sm text-brand-gray-300">
            {withPhoto} with photos · {pending} waiting
            {notFound > 0 ? ` · ${notFound} no Google match` : ""}
            {failed > 0 ? ` · ${failed} failed` : ""}. Needs &ldquo;Places API
            (New)&rdquo; enabled on your Google Maps key.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="places-batch">
            Batch size
          </label>
          <select
            id="places-batch"
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
            className="rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-black transition hover:bg-brand-orange/90 disabled:opacity-50"
          >
            {busy ? "Fetching…" : "Fetch venue photos"}
          </button>

          {failed > 0 ? (
            <button
              type="button"
              onClick={retryFailed}
              disabled={busy}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              Retry failed
            </button>
          ) : null}
        </div>
      </div>

      {busy ? (
        <p className="mt-3 text-sm text-brand-gray-400">
          Looking up {batch} businesses on Google Maps. Leave the page open.
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
              {result.photos} photos, {result.noPhoto} matched without a photo,{" "}
              {result.notFound} not on Google, {result.failed} failed.{" "}
              {Math.max(0, result.remainingBefore - result.attempted)} still
              waiting.
            </p>
          )}

          {result.failures.length > 0 ? (
            <ul className="space-y-0.5 text-xs text-brand-gray-400">
              {result.failures.slice(0, 10).map((f) => (
                <li key={f.businessName}>
                  <span className="text-brand-gray-300">{f.businessName}</span> —{" "}
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
