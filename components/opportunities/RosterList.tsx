"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  Check,
  UserX,
  X,
} from "lucide-react";
import {
  reorderOpenMicSignup,
  setOpenMicSignupStatus,
  removeOpenMicSignup,
} from "@/app/opportunities/actions";
import type { OpenMicSignup } from "@/lib/supabase/marketplace";

export function RosterList({ roster }: { roster: OpenMicSignup[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(id: string, fn: () => Promise<{ error?: string }>) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const { error: serverError } = await fn();
      setPendingId(null);
      if (serverError) {
        setError(serverError);
        return;
      }
      router.refresh();
    });
  }

  if (roster.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
        <p className="text-sm text-brand-gray-300">
          No bands have signed up yet. Share the open mic post so bands can join
          the running order.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <ol className="space-y-2">
        {roster.map((s, i) => {
          const busy = pendingId === s.id;
          const isFirst = i === 0;
          const isLast = i === roster.length - 1;
          const checkedIn = s.status === "checked_in";
          const noShow = s.status === "no_show";

          return (
            <li
              key={s.id}
              className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition ${
                checkedIn
                  ? "border-emerald-500/30 bg-emerald-500/[.07]"
                  : noShow
                    ? "border-red-500/25 bg-red-500/[.05] opacity-70"
                    : "border-white/10 bg-black/40"
              } ${busy ? "opacity-60" : ""}`}
            >
              {/* Position */}
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
                {i + 1}
              </span>

              {/* Band identity */}
              <Link
                href={`/profile/${s.band_profile_id}`}
                className="flex min-w-0 flex-1 items-center gap-2.5"
              >
                {s.band_avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.band_avatar_url}
                    alt=""
                    className="h-9 w-9 flex-shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-gray-800 text-xs font-bold text-purple-300 ring-1 ring-white/10">
                    {s.band_name.charAt(0)}
                  </div>
                )}
                <span className="truncate text-sm font-semibold text-white">
                  {s.band_name}
                </span>
              </Link>

              {/* Reorder controls */}
              <div className="flex items-center gap-1">
                <IconButton
                  label="Move to top"
                  disabled={busy || isFirst}
                  onClick={() => run(s.id, () => reorderOpenMicSignup(s.id, "top"))}
                >
                  <ChevronsUp className="h-4 w-4" strokeWidth={2.25} />
                </IconButton>
                <IconButton
                  label="Move up"
                  disabled={busy || isFirst}
                  onClick={() => run(s.id, () => reorderOpenMicSignup(s.id, "up"))}
                >
                  <ChevronUp className="h-4 w-4" strokeWidth={2.25} />
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={busy || isLast}
                  onClick={() =>
                    run(s.id, () => reorderOpenMicSignup(s.id, "down"))
                  }
                >
                  <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
                </IconButton>
              </div>

              {/* Status controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(s.id, () =>
                      setOpenMicSignupStatus(
                        s.id,
                        checkedIn ? "signed_up" : "checked_in",
                      ),
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                    checkedIn
                      ? "bg-emerald-500 text-black hover:bg-emerald-400"
                      : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {checkedIn ? "Checked in" : "Check in"}
                </button>

                <IconButton
                  label={noShow ? "Clear no-show" : "Mark no-show"}
                  disabled={busy}
                  onClick={() =>
                    run(s.id, () =>
                      setOpenMicSignupStatus(
                        s.id,
                        noShow ? "signed_up" : "no_show",
                      ),
                    )
                  }
                  variant={noShow ? "danger-active" : "default"}
                >
                  <UserX className="h-4 w-4" strokeWidth={2.25} />
                </IconButton>

                <IconButton
                  label="Remove from lineup"
                  disabled={busy}
                  onClick={() => run(s.id, () => removeOpenMicSignup(s.id))}
                  variant="danger"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "default" | "danger" | "danger-active";
}) {
  const styles =
    variant === "danger"
      ? "text-brand-gray-400 hover:bg-red-500/15 hover:text-red-300"
      : variant === "danger-active"
        ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
        : "text-brand-gray-300 hover:bg-white/10 hover:text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-30 ${styles}`}
    >
      {children}
    </button>
  );
}
