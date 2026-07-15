import { getAdminServiceClient } from "@/lib/supabase/admin-guard";
import { getAdminStats } from "@/lib/supabase/admin";
import { PLAYER_TYPE_OPTIONS } from "@/lib/types";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await getAdminServiceClient();
  const stats = await getAdminStats(supabase);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-brand-gray-300">
          Overall platform health and activity.
        </p>
      </div>

      {/* Top-line stats */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-gray-300">
          Overview
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={stats.totalUsers} />
          <StatCard
            label="Signups (last 7 days)"
            value={stats.signupsThisWeek}
            accent
          />
          <StatCard
            label="Published profiles"
            value={stats.publishedProfiles}
          />
          <StatCard
            label="Suspended"
            value={stats.suspendedProfiles}
            danger={stats.suspendedProfiles > 0}
          />
        </div>
      </section>

      {/* Player breakdown */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-gray-300">
          By player type
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PLAYER_TYPE_OPTIONS.map((opt) => (
            <StatCard
              key={opt.value}
              label={opt.label}
              icon={
                <PlayerTypeIcon
                  type={opt.value}
                  className="h-4 w-4 text-brand-gray-300"
                  strokeWidth={2}
                />
              }
              value={stats.byPlayerType[opt.value] ?? 0}
            />
          ))}
        </div>
        {stats.byPlayerType.none > 0 && (
          <p className="mt-2 text-xs text-brand-gray-400">
            {stats.byPlayerType.none} user(s) signed up but haven&apos;t chosen a
            player type yet.
          </p>
        )}
      </section>

      {/* Activity */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-gray-300">
          Activity
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active marketplace posts"
            value={stats.activeMarketplacePosts}
          />
          <StatCard
            label="Total connection requests"
            value={stats.totalConnectionRequests}
          />
          <StatCard
            label="Pending requests"
            value={stats.pendingRequests}
            accent={stats.pendingRequests > 0}
          />
          <StatCard label="Conversations" value={stats.totalThreads} />
          <StatCard label="Messages sent" value={stats.totalMessages} />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  danger,
  icon,
}: {
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
}) {
  const valueColor = danger
    ? "text-red-400"
    : accent
      ? "text-brand-orange"
      : "text-white";
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-gray-300">
        {icon}
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
