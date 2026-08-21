"use client";

import { useRef, useState, useTransition } from "react";
import { Globe } from "lucide-react";
import {
  adminCheckWebsites,
  adminResetWebsiteChecks,
  adminDeactivateDeadListings,
} from "@/app/admin/directory/actions";
import type { DeadListing } from "@/lib/directory/websiteCheckJob";
import type { DeadListingRow } from "@/lib/supabase/adminDirectory";

const BATCH_OPTIONS = [10, 25, 50, 100];
/** Gap between auto-run batches, so it reads as steady progress rather than a stall. */
const AUTO_RUN_DELAY_MS = 400;

type Props = {
  live: number;
  dead: number;
  uncertain: number;
  noWebsite: number;
  pending: number;
  initialDeadListings: DeadListingRow[];
};

/**
 * Confirms whether each listing's website is still up, and lets an admin
 * retire the confirmed-dead ones. Free — a plain fetch, no API key.
 *
 * "Auto-check" repeatedly runs a batch until nothing is left pending, so an
 * admin can start it and leave the tab open instead of clicking through
 * dozens of manual batches.
 */
export function DirectoryWebsiteCheckPanel({
  live,
  dead,
  uncertain,
  noWebsite,
  pending: initialPending,
  initialDeadListings,
}: Props) {
  const [busy, startTransition] = useTransition();
  const [batch, setBatch] = useState(25);
  const [autoRun, setAutoRun] = useState(false);
  const autoRunRef = useRef(false);

  const [pending, setPending] = useState(initialPending);
  const [tally, setTally] = useState({ live, dead, uncertain });
  const [deadList, setDeadList] = useState<Map<string, DeadListing>>(
    new Map(
      initialDeadListings.map((d) => [
        d.id,
        { id: d.id, businessName: d.businessName, websiteUrl: d.websiteUrl ?? "", reason: d.reason ?? "" },
      ]),
    ),
  );

  const [error, setError] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [deactivateMsg, setDeactivateMsg] = useState<string | null>(null);

  function runBatch() {
    setError(null);
    setResetMsg(null);
    setDeactivateMsg(null);
    startTransition(async () => {
      const res = await adminCheckWebsites({ limit: batch });

      if (res.error) {
        setError(res.error);
        autoRunRef.current = false;
        setAutoRun(false);
        return;
      }

      setTally((t) => ({
        live: t.live + res.live,
        dead: t.dead + res.dead,
        uncertain: t.uncertain + res.uncertain,
      }));
      const stillPending = Math.max(0, res.remainingBefore - res.attempted);
      setPending(stillPending);
      setDeadList((prev) => {
        const next = new Map(prev);
        for (const d of res.deadListings) next.set(d.id, d);
        return next;
      });

      if (autoRunRef.current && stillPending > 0) {
        setTimeout(() => {
          if (autoRunRef.current) runBatch();
        }, AUTO_RUN_DELAY_MS);
      } else {
        autoRunRef.current = false;
        setAutoRun(false);
      }
    });
  }

  function toggleAutoRun() {
    if (autoRun) {
      autoRunRef.current = false;
      setAutoRun(false);
      return;
    }
    autoRunRef.current = true;
    setAutoRun(true);
    runBatch();
  }

  function retryDeadAndUncertain() {
    setError(null);
    setDeactivateMsg(null);
    startTransition(async () => {
      const res = await adminResetWebsiteChecks();
      if (res.error) {
        setResetMsg(res.error);
        return;
      }
      setResetMsg(
        `${res.reset} listing(s) queued to recheck. Run a batch to pick them up.`,
      );
      setPending((p) => p + res.reset);
      setTally((t) => ({ ...t, dead: 0, uncertain: 0 }));
      setDeadList(new Map());
    });
  }

  function deactivate() {
    const businesses = [...deadList.values()];
    if (businesses.length === 0) return;
    const ok = window.confirm(
      `Hide ${businesses.length} listing(s) with a confirmed-dead website from the public directory?\n\n` +
        `This sets them inactive, reversible any time from a row's "Show in directory" toggle, not a permanent delete.`,
    );
    if (!ok) return;

    setError(null);
    setResetMsg(null);
    startTransition(async () => {
      const res = await adminDeactivateDeadListings();
      if (res.error) {
        setError(res.error);
        return;
      }
      setDeactivateMsg(
        `${res.deactivated} listing(s) hidden from the public directory.`,
      );
      setDeadList(new Map());
    });
  }

  const totalChecked = tally.live + tally.dead + tally.uncertain + noWebsite;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-bold text-white">
            <Globe className="h-4 w-4 text-brand-orange" aria-hidden="true" />
            Website check (free)
          </h2>
          <p className="mt-1 text-sm text-brand-gray-300">
            {tally.live} live · {tally.dead} dead · {tally.uncertain} uncertain
            {noWebsite > 0 ? ` · ${noWebsite} no website` : ""} · {pending}{" "}
            waiting. Confirms each business's site still responds, no API
            key, no cost. Safe to stop and continue later.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="website-check-batch">
            Batch size
          </label>
          <select
            id="website-check-batch"
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value))}
            disabled={autoRun}
            className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm font-semibold text-white focus:border-brand-orange/50 focus:outline-none disabled:opacity-50"
          >
            {BATCH_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} at a time
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={runBatch}
            disabled={busy || autoRun || pending === 0}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white tappable hover:bg-white/10 disabled:opacity-50"
          >
            {busy && !autoRun ? "Checking…" : "Check batch"}
          </button>

          <button
            type="button"
            onClick={toggleAutoRun}
            disabled={pending === 0 && !autoRun}
            className={`rounded-full px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
              autoRun
                ? "bg-white/10 text-white hover:bg-white/15"
                : "bg-brand-orange text-black hover:bg-brand-orange/90"
            }`}
          >
            {autoRun ? "Stop" : "Auto-check all"}
          </button>

          {tally.dead + tally.uncertain > 0 ? (
            <button
              type="button"
              onClick={retryDeadAndUncertain}
              disabled={busy || autoRun}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white tappable hover:bg-white/10 disabled:opacity-50"
            >
              Recheck dead/uncertain
            </button>
          ) : null}
        </div>
      </div>

      {autoRun ? (
        <p className="mt-3 text-sm text-brand-gray-400">
          Auto-checking {pending} remaining site{pending === 1 ? "" : "s"},
          leave this tab open. Checked {totalChecked} so far.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm font-semibold text-red-300">{error}</p> : null}
      {resetMsg ? <p className="mt-3 text-sm text-brand-gray-300">{resetMsg}</p> : null}
      {deactivateMsg ? (
        <p className="mt-3 text-sm font-semibold text-emerald-300">{deactivateMsg}</p>
      ) : null}

      {deadList.size > 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-red-300">
              {deadList.size} listing{deadList.size === 1 ? "" : "s"} confirmed
              dead: website returned a hard 404/410, or the domain no longer
              resolves.
            </p>
            <button
              type="button"
              onClick={deactivate}
              disabled={busy}
              className="rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
            >
              Hide {deadList.size} dead listing{deadList.size === 1 ? "" : "s"}
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-brand-gray-400">
            {[...deadList.values()].slice(0, 15).map((d) => (
              <li key={d.id}>
                <span className="text-brand-gray-200">{d.businessName}</span>:{" "}
                {d.websiteUrl} ({d.reason})
              </li>
            ))}
            {deadList.size > 15 ? <li>…and {deadList.size - 15} more.</li> : null}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
