"use client";

import { useState, useTransition } from "react";
import {
  adminSetDirectoryTier,
  adminSetDirectoryOutreach,
  adminToggleDirectoryActive,
  adminLinkDirectoryProfile,
} from "@/app/admin/directory/actions";
import {
  DIRECTORY_TIERS,
  OUTREACH_STATUSES,
  OUTREACH_LABELS,
  type AdminDirectoryRow,
  type DirectoryTier,
  type OutreachStatus,
} from "@/lib/supabase/adminDirectory";

/**
 * The per-row admin controls: tier, outreach state, active toggle, and the
 * link to a real profile once a business signs up. Each uses useTransition and
 * the `{ error?: string }` return convention shared with the other admin
 * buttons (see TogglePublishButton).
 */

export function DirectoryTierSelect({
  businessId,
  current,
}: {
  businessId: string;
  current: DirectoryTier;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(tier: DirectoryTier) {
    if (tier === current) return;
    setError(null);
    startTransition(async () => {
      const res = await adminSetDirectoryTier(businessId, tier);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div>
      <div className="inline-flex rounded-full border border-white/10 bg-black/30 p-0.5">
        {DIRECTORY_TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => set(tier)}
            disabled={pending}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition disabled:opacity-50 ${
              tier === current
                ? "bg-brand-orange text-black"
                : "text-brand-gray-400 hover:text-white"
            }`}
          >
            {tier}
          </button>
        ))}
      </div>
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

export function DirectoryOutreachControl({ row }: { row: AdminDirectoryRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<OutreachStatus>(row.outreachStatus);
  const [notes, setNotes] = useState(row.outreachNotes ?? "");
  const [saved, setSaved] = useState(false);

  const dirty = status !== row.outreachStatus || notes !== (row.outreachNotes ?? "");

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await adminSetDirectoryOutreach(row.id, { status, notes });
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OutreachStatus);
            setSaved(false);
          }}
          className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs font-semibold text-white focus:border-brand-orange/50 focus:outline-none"
        >
          {OUTREACH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {OUTREACH_LABELS[s]}
            </option>
          ))}
        </select>

        {dirty ? (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-black transition hover:bg-brand-orange/90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        ) : null}

        {saved && !dirty ? (
          <span className="text-xs font-semibold text-emerald-300">Saved</span>
        ) : null}
      </div>

      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        rows={2}
        placeholder="Outreach notes…"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-brand-gray-500 focus:border-brand-orange/50 focus:outline-none"
      />

      {row.lastContactedAt ? (
        <p className="text-xs text-brand-gray-500">
          Last contacted {new Date(row.lastContactedAt).toLocaleDateString()}
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

export function DirectoryActiveToggle({
  businessId,
  isActive,
}: {
  businessId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const res = await adminToggleDirectoryActive(businessId, !isActive);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        {pending ? "…" : isActive ? "Hide from directory" : "Show in directory"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

export function DirectoryClaimLink({
  businessId,
  claimedProfileId,
}: {
  businessId: string;
  claimedProfileId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");

  function submit(profileId: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await adminLinkDirectoryProfile(businessId, profileId);
      if (res.error) setError(res.error);
      else setValue("");
    });
  }

  if (claimedProfileId) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/profile/${claimedProfileId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-brand-orange hover:underline"
        >
          View claimed profile
        </a>
        <button
          type="button"
          onClick={() => submit(null)}
          disabled={pending}
          className="text-xs font-semibold text-brand-gray-400 hover:text-white disabled:opacity-50"
        >
          Unlink
        </button>
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Profile ID to link…"
        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white placeholder:text-brand-gray-500 focus:border-brand-orange/50 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => submit(value)}
        disabled={pending || !value.trim()}
        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-40"
      >
        Link
      </button>
      {error ? <p className="w-full text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
