import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminUserDetail } from "@/lib/supabase/admin";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";
import { SuspendUserButton } from "@/components/admin/SuspendUserButton";
import { UnsuspendUserButton } from "@/components/admin/UnsuspendUserButton";
import { DeleteUserButton } from "@/components/admin/DeleteUserButton";
import { TogglePublishButton } from "@/components/admin/TogglePublishButton";
import { AdminContactPanel } from "@/components/admin/AdminContactPanel";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabaseClient();
  const user = await getAdminUserDetail(supabase, params.id);
  if (!user) notFound();

  const playerTypeLabel = user.player_type
    ? PLAYER_TYPE_OPTIONS.find((o) => o.value === user.player_type)?.label
    : "—";

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/users"
            className="text-xs text-brand-gray-300 hover:text-white"
          >
            ← Back to users
          </Link>
          <h1 className="mt-2 text-3xl font-bold">{user.display_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {user.is_suspended && (
              <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300">
                🚫 Suspended
              </span>
            )}
            {user.is_published ? (
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                Published
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-brand-gray-300">
                Unpublished
              </span>
            )}
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-brand-gray-300">
              {playerTypeLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {user.profile_id && (
            <Link
              href={`/profile/${user.profile_id}`}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              View public profile
            </Link>
          )}
        </div>
      </div>

      {/* Suspension banner */}
      {user.is_suspended && user.suspended_reason && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-red-300">
            Suspension reason
          </p>
          <p className="mt-1 text-sm text-red-100">{user.suspended_reason}</p>
          {user.suspended_at && (
            <p className="mt-1 text-xs text-red-300/80">
              Suspended {new Date(user.suspended_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Account info */}
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gray-300">
            Account
          </h2>
          <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-5">
            <DetailRow label="Email" value={user.email ?? "—"} />
            <DetailRow label="Full name" value={user.full_name ?? "—"} />
            <DetailRow
              label="Joined"
              value={new Date(user.created_at).toLocaleString()}
            />
            <DetailRow label="Phone" value={user.phone_number ?? "—"} />
            <DetailRow label="Website" value={user.website_url ?? "—"} />
            <DetailRow
              label="Instagram"
              value={
                user.instagram_handle
                  ? `${user.instagram_handle}${
                      user.instagram_followers
                        ? ` (${user.instagram_followers.toLocaleString()} followers)`
                        : ""
                    }`
                  : "—"
              }
            />
            <DetailRow
              label="Address"
              value={
                user.street_address
                  ? `${user.street_address}, ${user.city ?? ""}, ${user.state ?? ""} ${user.zip_code ?? ""}`
                  : "—"
              }
            />
            <DetailRow label="Bio" value={user.bio ?? "—"} multiline />
          </div>

          {/* Activity */}
          <h2 className="pt-2 text-sm font-bold uppercase tracking-wider text-brand-gray-300">
            Activity
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Active posts" value={user.active_post_count} />
            <Mini label="Incoming requests" value={user.incoming_request_count} />
            <Mini label="Outgoing requests" value={user.outgoing_request_count} />
            <Mini label="Conversations" value={user.thread_count} />
          </div>
        </section>

        {/* Admin actions */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gray-300">
            Admin actions
          </h2>
          <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-5">
            {/* Contact */}
            {user.profile_id && (
              <AdminContactPanel
                userId={user.user_id}
                profileId={user.profile_id}
                email={user.email}
                displayName={user.display_name}
              />
            )}

            <div className="my-3 h-px bg-white/10" />

            {/* Publish toggle */}
            {user.profile_id && !user.is_suspended && (
              <TogglePublishButton
                profileId={user.profile_id}
                currentlyPublished={user.is_published}
              />
            )}

            {/* Suspend / Unsuspend */}
            {user.profile_id && (
              user.is_suspended ? (
                <UnsuspendUserButton profileId={user.profile_id} />
              ) : (
                <SuspendUserButton profileId={user.profile_id} />
              )
            )}

            <div className="my-3 h-px bg-white/10" />

            {/* Delete */}
            <DeleteUserButton
              userId={user.user_id}
              displayName={user.display_name}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-gray-400">
        {label}
      </p>
      <p
        className={`mt-1 text-sm text-white ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-3">
      <p className="text-xs text-brand-gray-300">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
