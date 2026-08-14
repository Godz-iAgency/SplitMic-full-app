import Link from "next/link";
import { getAdminServiceClient } from "@/lib/supabase/admin-guard";
import {
  getAdminDirectoryRows,
  getAdminDirectoryCounts,
  getScreenshotProgress,
  getOgImageProgress,
  getWebsiteCheckProgress,
  getDeadListings,
  OUTREACH_STATUSES,
  OUTREACH_LABELS,
  DIRECTORY_TIERS,
  type AdminDirectoryFilters,
  type DirectoryTier,
  type OutreachStatus,
} from "@/lib/supabase/adminDirectory";
import {
  CATEGORY_META,
  DIRECTORY_CATEGORIES,
  type DirectoryCategory,
} from "@/lib/directory/categories";
import { DirectoryImportPanel } from "@/components/admin/DirectoryImportPanel";
import { DirectoryScreenshotPanel } from "@/components/admin/DirectoryScreenshotPanel";
import { DirectoryOgImagePanel } from "@/components/admin/DirectoryOgImagePanel";
import { DirectoryWebsiteCheckPanel } from "@/components/admin/DirectoryWebsiteCheckPanel";
import {
  DirectoryTierSelect,
  DirectoryOutreachControl,
  DirectoryActiveToggle,
  DirectoryClaimLink,
} from "@/components/admin/DirectoryRowControls";
import { AdminUserSearchBox } from "@/components/admin/AdminUserSearchBox";

export const dynamic = "force-dynamic";

type SearchParams = {
  category?: string;
  tier?: string;
  outreach?: string;
  email?: string;
  claimed?: string;
  q?: string;
};

export default async function AdminDirectoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await getAdminServiceClient();

  const filters: AdminDirectoryFilters = {
    category: asCategory(searchParams.category),
    tier: asTier(searchParams.tier),
    outreach: asOutreach(searchParams.outreach),
    email: searchParams.email === "has" || searchParams.email === "none"
      ? searchParams.email
      : undefined,
    claimed: searchParams.claimed === "yes" || searchParams.claimed === "no"
      ? searchParams.claimed
      : undefined,
    query: searchParams.q,
  };

  const [{ rows, total, truncated }, counts, shots, ogImages, websiteCheck, deadListings] =
    await Promise.all([
      getAdminDirectoryRows(supabase, filters),
      getAdminDirectoryCounts(supabase),
      getScreenshotProgress(supabase),
      getOgImageProgress(supabase),
      getWebsiteCheckProgress(supabase),
      getDeadListings(supabase),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Business directory</h1>
        <p className="mt-1 text-sm text-brand-gray-300">
          Curate listings and track outreach. Public page:{" "}
          <Link href="/directory" className="text-brand-orange hover:underline">
            /directory
          </Link>
        </p>
      </div>

      <DirectoryImportPanel currentTotal={counts.total} />

      {counts.total > 0 ? (
        <>
          {/* OG image first: free, and the card prefers it when both exist. */}
          <DirectoryOgImagePanel
            done={ogImages.done}
            pending={ogImages.pending}
            failed={ogImages.failed}
          />
          <DirectoryScreenshotPanel
            done={shots.done}
            pending={shots.pending}
            failed={shots.failed}
          />
          <DirectoryWebsiteCheckPanel
            live={websiteCheck.live}
            dead={websiteCheck.dead}
            uncertain={websiteCheck.uncertain}
            noWebsite={websiteCheck.noWebsite}
            pending={websiteCheck.pending}
            initialDeadListings={deadListings}
          />
        </>
      ) : null}

      <div className="space-y-3">
        <AdminUserSearchBox placeholder="Search businesses by name..." />

        <FilterGroup label="Category">
          <FilterPill href={buildHref(searchParams, { category: undefined })} active={!filters.category}>
            All
          </FilterPill>
          {DIRECTORY_CATEGORIES.map((c) => (
            <FilterPill
              key={c}
              href={buildHref(searchParams, { category: c })}
              active={filters.category === c}
            >
              {CATEGORY_META[c].plural} ({counts.byCategory[c] ?? 0})
            </FilterPill>
          ))}
        </FilterGroup>

        <FilterGroup label="Tier">
          <FilterPill href={buildHref(searchParams, { tier: undefined })} active={!filters.tier}>
            Any
          </FilterPill>
          {DIRECTORY_TIERS.map((t) => (
            <FilterPill
              key={t}
              href={buildHref(searchParams, { tier: t })}
              active={filters.tier === t}
            >
              <span className="capitalize">{t}</span>
            </FilterPill>
          ))}
        </FilterGroup>

        <FilterGroup label="Outreach">
          <FilterPill href={buildHref(searchParams, { outreach: undefined })} active={!filters.outreach}>
            Any
          </FilterPill>
          {OUTREACH_STATUSES.map((s) => (
            <FilterPill
              key={s}
              href={buildHref(searchParams, { outreach: s })}
              active={filters.outreach === s}
            >
              {OUTREACH_LABELS[s]}
            </FilterPill>
          ))}
        </FilterGroup>

        <FilterGroup label="Contactable">
          <FilterPill href={buildHref(searchParams, { email: undefined })} active={!filters.email}>
            Any
          </FilterPill>
          <FilterPill href={buildHref(searchParams, { email: "has" })} active={filters.email === "has"}>
            Has email
          </FilterPill>
          <FilterPill href={buildHref(searchParams, { email: "none" })} active={filters.email === "none"}>
            No email
          </FilterPill>
          <FilterPill href={buildHref(searchParams, { claimed: "yes" })} active={filters.claimed === "yes"}>
            Claimed
          </FilterPill>
          <FilterPill href={buildHref(searchParams, { claimed: "no" })} active={filters.claimed === "no"}>
            Unclaimed
          </FilterPill>
        </FilterGroup>
      </div>

      <p className="text-sm text-brand-gray-300">
        {truncated
          ? `Showing ${rows.length} of ${total} — narrow the filters to see the rest.`
          : `${total} ${total === 1 ? "business" : "businesses"}.`}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
          <p className="text-sm text-brand-gray-300">
            {counts.total === 0
              ? "Nothing imported yet. Run the migration, then use the import panel above."
              : "No businesses match these filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`rounded-2xl border p-4 ${
                row.isActive
                  ? "border-white/5 bg-white/5"
                  : "border-white/5 bg-white/[0.02] opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-orange/20 px-2 py-0.5 text-xs font-bold uppercase text-brand-orange">
                      {CATEGORY_META[row.category].label}
                    </span>
                    {row.subcategory ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-brand-gray-300">
                        {row.subcategory}
                      </span>
                    ) : null}
                    {!row.isActive ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-brand-gray-300">
                        Hidden
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-2 text-lg font-bold text-white">
                    {row.businessName}
                  </h3>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-gray-300">
                    {row.email ? (
                      <a href={`mailto:${row.email}`} className="hover:text-brand-orange">
                        {row.email}
                      </a>
                    ) : (
                      <span className="text-brand-gray-500">No email</span>
                    )}
                    {row.phone ? <span>{row.phone}</span> : null}
                    {row.websiteUrl ? (
                      <a
                        href={row.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:text-brand-orange"
                      >
                        {displayHost(row.websiteUrl)}
                      </a>
                    ) : null}
                  </div>

                  {row.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-brand-gray-400">
                      {row.description}
                    </p>
                  ) : null}
                </div>

                <div className="w-full space-y-2 sm:w-72">
                  <DirectoryTierSelect businessId={row.id} current={row.tier} />
                  <DirectoryOutreachControl row={row} />
                  <DirectoryClaimLink
                    businessId={row.id}
                    claimedProfileId={row.claimedProfileId}
                  />
                  <DirectoryActiveToggle businessId={row.id} isActive={row.isActive} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

function asCategory(value?: string): DirectoryCategory | undefined {
  return DIRECTORY_CATEGORIES.includes(value as DirectoryCategory)
    ? (value as DirectoryCategory)
    : undefined;
}

function asTier(value?: string): DirectoryTier | undefined {
  return DIRECTORY_TIERS.includes(value as DirectoryTier)
    ? (value as DirectoryTier)
    : undefined;
}

function asOutreach(value?: string): OutreachStatus | undefined {
  return OUTREACH_STATUSES.includes(value as OutreachStatus)
    ? (value as OutreachStatus)
    : undefined;
}

/** Preserves the other active filters when one pill changes. */
function buildHref(current: SearchParams, patch: Partial<SearchParams>): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...patch };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/admin/directory?${qs}` : "/admin/directory";
}

function displayHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-brand-gray-500">
        {label}
      </span>
      {children}
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
      scroll={false}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-brand-orange text-black"
          : "border border-white/10 bg-white/5 text-brand-gray-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
