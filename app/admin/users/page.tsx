import Link from "next/link";
import { Ban } from "lucide-react";
import { getAdminServiceClient } from "@/lib/supabase/admin-guard";
import { getAdminUsers } from "@/lib/supabase/admin";
import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";
import { AdminUserSearchBox } from "@/components/admin/AdminUserSearchBox";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string; q?: string };
}) {
  const supabase = await getAdminServiceClient();
  const validTypes = new Set([
    "all",
    "band",
    "venue",
    "talent_buyer",
    "record_label",
    "festival",
  ]);
  const type = (validTypes.has(searchParams.type ?? "")
    ? searchParams.type
    : "all") as PlayerType | "all";
  const status = searchParams.status ?? "all";
  const query = searchParams.q?.trim() ?? "";

  const rows = await getAdminUsers(supabase, {
    playerType: type,
    suspendedOnly: status === "suspended",
    unpublishedOnly: status === "unpublished",
    query,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-brand-gray-300">
            {rows.length} {rows.length === 1 ? "user" : "users"} shown.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <AdminUserSearchBox />
        <div className="flex flex-wrap gap-2">
          <FilterPill href={`/admin/users?status=${status}`} active={type === "all"}>
            All types
          </FilterPill>
          {PLAYER_TYPE_OPTIONS.map((opt) => (
            <FilterPill
              key={opt.value}
              href={`/admin/users?type=${opt.value}&status=${status}`}
              active={type === opt.value}
            >
              {opt.icon} {opt.label}
            </FilterPill>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterPill href={`/admin/users?type=${type}`} active={status === "all"}>
            All statuses
          </FilterPill>
          <FilterPill
            href={`/admin/users?type=${type}&status=unpublished`}
            active={status === "unpublished"}
          >
            Unpublished
          </FilterPill>
          <FilterPill
            href={`/admin/users?type=${type}&status=suspended`}
            active={status === "suspended"}
          >
            <span className="inline-flex items-center gap-1.5">
              <Ban className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              Suspended
            </span>
          </FilterPill>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
          <p className="text-sm text-brand-gray-300">No users match.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-brand-gray-300">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.user_id}
                  className="border-t border-white/5 hover:bg-white/5"
                >
                  <td className="px-4 py-3 font-semibold text-white">
                    {r.display_name}
                  </td>
                  <td className="px-4 py-3 text-brand-gray-300">
                    {r.player_type
                      ? PLAYER_TYPE_OPTIONS.find((o) => o.value === r.player_type)
                          ?.label ?? r.player_type
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-brand-gray-300">
                    {r.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-brand-gray-300">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.is_suspended ? (
                      <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-bold text-red-300">
                        Suspended
                      </span>
                    ) : r.is_published ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-300">
                        Published
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-brand-gray-300">
                        Unpublished
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${r.user_id}`}
                      className="rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-black transition hover:bg-brand-orange/90"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-brand-orange text-black"
          : "bg-white/5 text-brand-gray-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
