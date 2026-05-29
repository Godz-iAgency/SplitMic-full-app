import Link from "next/link";
import { getAdminServiceClient } from "@/lib/supabase/admin-guard";
import { getAdminRequests } from "@/lib/supabase/admin";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminConnectionsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = await getAdminServiceClient();
  const validStatuses = new Set(["all", "pending", "accepted", "declined"]);
  const status = (
    validStatuses.has(searchParams.status ?? "") ? searchParams.status : "all"
  ) as "all" | "pending" | "accepted" | "declined";

  const rows = await getAdminRequests(supabase, { status });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Connection requests</h1>
        <p className="mt-1 text-sm text-brand-gray-300">
          {rows.length} {rows.length === 1 ? "request" : "requests"} shown.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "accepted", "declined"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/connections?status=${s}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
              status === s
                ? "bg-brand-orange text-black"
                : "bg-white/5 text-brand-gray-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
          <p className="text-sm text-brand-gray-300">No requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.request_id}
              className="rounded-2xl border border-white/5 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                    r.status === "pending"
                      ? "bg-brand-orange/20 text-brand-orange"
                      : r.status === "accepted"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {r.status}
                </span>
                <span className="text-xs text-brand-gray-400">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <Link
                  href={`/profile/${r.requester_profile_id}`}
                  className="font-semibold text-white hover:underline"
                >
                  {r.requester_name}
                </Link>
                <span className="text-brand-gray-400">
                  ({playerLabel(r.requester_player_type)})
                </span>
                <span className="text-brand-gray-400">→</span>
                <Link
                  href={`/profile/${r.recipient_profile_id}`}
                  className="font-semibold text-white hover:underline"
                >
                  {r.recipient_name}
                </Link>
                <span className="text-brand-gray-400">
                  ({playerLabel(r.recipient_player_type)})
                </span>
              </div>
              {r.message && (
                <p className="mt-2 rounded-xl bg-black/30 p-3 text-sm text-brand-gray-200">
                  &ldquo;{r.message}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function playerLabel(t: string): string {
  return PLAYER_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}
