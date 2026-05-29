import { getAdminServiceClient } from "@/lib/supabase/admin-guard";
import { getAdminLog } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  suspend_user: { label: "Suspended user", color: "text-red-300 bg-red-500/20" },
  unsuspend_user: {
    label: "Unsuspended user",
    color: "text-emerald-300 bg-emerald-500/20",
  },
  delete_user: {
    label: "Deleted user",
    color: "text-red-300 bg-red-500/30",
  },
  delete_post: {
    label: "Deleted post",
    color: "text-red-300 bg-red-500/20",
  },
  send_in_app_message: {
    label: "Sent in-app message",
    color: "text-brand-orange bg-brand-orange/20",
  },
  send_email: { label: "Sent email", color: "text-blue-300 bg-blue-500/20" },
  force_publish: {
    label: "Force published",
    color: "text-emerald-300 bg-emerald-500/20",
  },
  force_unpublish: {
    label: "Force unpublished",
    color: "text-yellow-300 bg-yellow-500/20",
  },
};

export default async function AdminLogPage() {
  const supabase = await getAdminServiceClient();
  const entries = await getAdminLog(supabase, 200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Action log</h1>
        <p className="mt-1 text-sm text-brand-gray-300">
          Every admin action is recorded here. Most recent {entries.length} shown.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
          <p className="text-sm text-brand-gray-300">
            No admin actions yet. As soon as you suspend, delete, or message a
            user, it&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-brand-gray-300">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const meta =
                  ACTION_LABEL[e.action_type] ?? {
                    label: e.action_type,
                    color: "text-brand-gray-300 bg-white/10",
                  };
                return (
                  <tr key={e.id} className="border-t border-white/5">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-brand-gray-300">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-gray-300">
                      {e.admin_email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white">
                      {e.target_label ?? e.target_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-gray-300">
                      {e.details ? (
                        <pre className="max-w-xs overflow-hidden text-ellipsis whitespace-pre-wrap text-[10px]">
                          {JSON.stringify(e.details, null, 0)}
                        </pre>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
