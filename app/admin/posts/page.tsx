import Link from "next/link";
import { getAdminServiceClient } from "@/lib/supabase/admin-guard";
import { getAdminPosts } from "@/lib/supabase/admin";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";
import { AdminDeletePostButton } from "@/components/admin/AdminDeletePostButton";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = await getAdminServiceClient();
  const activeOnly = (searchParams.status ?? "active") === "active";
  const rows = await getAdminPosts(supabase, { activeOnly });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Marketplace posts</h1>
        <p className="mt-1 text-sm text-brand-gray-300">
          {rows.length} {rows.length === 1 ? "post" : "posts"} shown.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterPill href="/admin/posts?status=active" active={activeOnly}>
          Active only
        </FilterPill>
        <FilterPill href="/admin/posts?status=all" active={!activeOnly}>
          All (including expired)
        </FilterPill>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
          <p className="text-sm text-brand-gray-300">No posts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div
              key={p.post_id}
              className="rounded-2xl border border-white/5 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                        p.post_type === "event"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-brand-orange/20 text-brand-orange"
                      }`}
                    >
                      {p.post_type}
                    </span>
                    {!p.is_active && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-brand-gray-300">
                        Expired
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 truncate text-lg font-bold text-white">
                    {p.title}
                  </h3>
                  <p className="mt-1 text-sm text-brand-gray-300">
                    by{" "}
                    <Link
                      href={`/profile/${p.poster_profile_id}`}
                      className="font-semibold text-white hover:underline"
                    >
                      {p.poster_name}
                    </Link>{" "}
                    ·{" "}
                    {PLAYER_TYPE_OPTIONS.find(
                      (o) => o.value === p.poster_player_type,
                    )?.label ?? p.poster_player_type}
                  </p>
                  <p className="mt-1 text-xs text-brand-gray-400">
                    Posted {new Date(p.created_at).toLocaleString()}
                    {p.event_date && (
                      <>
                        {" "}· Event{" "}
                        {new Date(p.event_date).toLocaleDateString()}
                      </>
                    )}
                    {p.expires_at && (
                      <>
                        {" "}· Expires {new Date(p.expires_at).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/opportunities/${p.post_id}`}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                  >
                    View
                  </Link>
                  <AdminDeletePostButton
                    postId={p.post_id}
                    title={p.title}
                  />
                </div>
              </div>
            </div>
          ))}
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
