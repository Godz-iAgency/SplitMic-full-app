import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ImagePlus,
  Globe,
  Phone,
  MapPin,
  Camera,
  Play,
  Music2,
  Music,
  ExternalLink,
  AtSign,
  DollarSign,
  ZoomIn,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { tableForPlayerType } from "@/lib/supabase/profile";
import {
  getConnectionState,
  isIndustryPlayerType,
} from "@/lib/supabase/messaging";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { InboxBell } from "@/components/inbox/InboxBell";
import { PublishButton } from "@/components/profile/PublishButton";
import { ProfileLiveStatus } from "@/components/profile/ProfileLiveStatus";
import { ConnectButton } from "@/components/inbox/ConnectButton";
import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";

export const dynamic = "force-dynamic";

const BUCKET = "profile-media";

const PLATFORM_LABELS: Record<string, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X / Twitter",
  bandcamp: "Bandcamp",
  soundcloud: "SoundCloud",
  website: "Website",
  other: "Link",
};

// Lucide icon per platform — falls back to ExternalLink
const PLATFORM_ICONS: Record<string, React.ElementType> = {
  spotify: Music2,
  apple_music: Music,
  youtube: Play,
  tiktok: Music2,
  instagram: Camera,
  facebook: ExternalLink,
  twitter: AtSign,
  bandcamp: Music,
  soundcloud: Music2,
  website: Globe,
  other: ExternalLink,
};

export default async function ProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (!viewer) redirect("/login");

  // Profile (RLS gates this: published OR owner)
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, user_id, player_type, street_address, address_line_2, city, state, zip_code, bio, phone_number, website_url, instagram_handle, instagram_followers, is_published",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!profile) notFound();

  const isOwner = viewer.id === profile.user_id;
  const playerType = profile.player_type as PlayerType;
  const playerOption = PLAYER_TYPE_OPTIONS.find((o) => o.value === playerType);

  // Owner info
  const { data: owner } = await supabase
    .from("users")
    .select("id, full_name, email")
    .eq("id", profile.user_id)
    .maybeSingle();

  // Viewer's own profile (for Connect button)
  let viewerProfile: { id: string; player_type: PlayerType; is_published: boolean } | null = null;
  let connectionState: {
    state: "none" | "pending_outbound" | "pending_inbound" | "connected";
    threadId: string | null;
  } = { state: "none", threadId: null };

  if (!isOwner && profile.is_published) {
    const { data: vp } = await supabase
      .from("profiles")
      .select("id, player_type, is_published")
      .eq("user_id", viewer.id)
      .maybeSingle();
    if (vp) {
      viewerProfile = {
        id: vp.id,
        player_type: vp.player_type as PlayerType,
        is_published: vp.is_published,
      };
      if (viewerProfile.is_published) {
        connectionState = await getConnectionState(
          supabase,
          viewerProfile.id,
          viewer.id,
          profile.id,
        );
      }
    }
  }

  // Player-type-specific details
  const detailTable = tableForPlayerType(playerType);
  const { data: details } = await supabase
    .from(detailTable)
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  // Media + links
  const { data: mediaRows } = await supabase
    .from("profile_media")
    .select("id, kind, storage_path, duration_seconds, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: true });

  const { data: linkRows } = await supabase
    .from("profile_links")
    .select("platform, url")
    .eq("profile_id", profile.id);

  const media = mediaRows ?? [];
  const links = linkRows ?? [];

  const banner = media.find((m) => m.kind === "banner");
  const avatar = media.find((m) => m.kind === "avatar");
  const video = media.find((m) => m.kind === "video");
  const gallery = media.filter((m) => m.kind === "gallery");

  const bannerUrl = banner ? publicUrl(supabase, banner.storage_path) : null;
  const avatarUrl = avatar ? publicUrl(supabase, avatar.storage_path) : null;
  const videoUrl = video ? publicUrl(supabase, video.storage_path) : null;

  const displayName =
    pickDetailName(playerType, details) ||
    owner?.full_name ||
    owner?.email?.split("@")[0] ||
    "Austin player";

  const addressParts = [
    profile.street_address,
    profile.address_line_2,
    [profile.city, profile.state].filter(Boolean).join(", "),
    profile.zip_code,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-20">
      <header className="flex items-center justify-between border-b border-white/10 shadow-sm shadow-black/40 px-5 py-4 sm:px-8">
        <Link href="/search">
          <Logo className="text-2xl" />
        </Link>
        <nav className="hidden items-center gap-2 sm:flex">
          <Link
            href="/search"
            className="rounded-full px-4 py-2 text-sm font-semibold text-brand-gray-300 transition hover:text-white"
          >
            Discover
          </Link>
          <Link
            href="/opportunities"
            className="rounded-full px-4 py-2 text-sm font-semibold text-brand-gray-300 transition hover:text-white"
          >
            Feed
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <InboxBell />
          {isOwner ? (
            <Link
              href="/profile/edit"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Edit profile
            </Link>
          ) : null}
          <LogoutButton />
        </div>
      </header>

      {/* LinkedIn-style card: banner + content share max-w-5xl wrapper */}
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-8">
        {/* Banner card with avatar overlay — locked to 3:1 to match the cropper */}
        <div className="relative mb-20 sm:mb-24">
          <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl bg-brand-gray-900 shadow-lg shadow-black/50 ring-1 ring-white/10">
            {bannerUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerUrl}
                  alt="Profile banner"
                  className="h-full w-full object-cover"
                />
                {/* Dark gradient overlay — fades the banner edges into the page */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70"
                />
                {/* Subtle orange glow accent in the top-right corner */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-brand-orange/20 blur-3xl"
                />
              </>
            ) : (
              <div className="relative h-full w-full bg-gradient-to-br from-brand-gray-900 via-black to-brand-orange/10">
                {/* Empty-state orange glow */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-brand-orange/15 blur-3xl"
                />
                {isOwner ? (
                  <Link
                    href="/profile/edit"
                    className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold text-brand-gray-400 transition hover:text-brand-orange"
                  >
                    <ImagePlus className="h-5 w-5" />
                    Add banner photo &amp; gallery
                  </Link>
                ) : null}
              </div>
            )}
          </div>

          {/* Avatar pinned to banner bottom edge, left-aligned inside the card */}
          <div className="absolute bottom-0 left-5 translate-y-1/2 sm:left-8">
            <div className="h-28 w-28 overflow-hidden rounded-full shadow-lg shadow-black/50 ring-2 ring-brand-orange/50 ring-offset-2 ring-offset-black sm:h-32 sm:w-32">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : isOwner ? (
                <Link
                  href="/profile/edit"
                  className="flex h-full w-full flex-col items-center justify-center gap-1 bg-brand-gray-900 transition hover:bg-brand-gray-800"
                >
                  <span className="text-2xl font-bold text-brand-orange">
                    {displayName.charAt(0)}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-400">
                    Add photo
                  </span>
                </Link>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand-gray-900 text-3xl font-bold text-brand-orange">
                  {displayName.charAt(0)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Identity + content — pl matches avatar's left offset so name aligns under avatar */}
        <section className="px-5 sm:px-8">
          <p className="text-xs uppercase tracking-widest text-brand-orange">
            {playerOption?.label ?? playerType}
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{displayName}</h1>
          {addressParts ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand-gray-400">
              <MapPin
                className="h-[18px] w-[18px] flex-shrink-0 text-brand-orange"
                strokeWidth={2}
                aria-hidden="true"
              />
              {addressParts}
            </p>
          ) : null}

        {/* Connect / Message button (only when viewing someone else's published profile) */}
        {!isOwner && profile.is_published && viewerProfile?.is_published ? (
          <div className="mt-5">
            <ConnectButton
              otherProfileId={profile.id}
              myMode={
                isIndustryPlayerType(viewerProfile.player_type)
                  ? "industry"
                  : "band"
              }
              initialState={connectionState.state}
              initialThreadId={connectionState.threadId}
            />
          </div>
        ) : null}

        {/* Bio */}
        {profile.bio ? (
          <p className="mt-6 max-w-3xl whitespace-pre-line text-base leading-relaxed text-brand-gray-200">
            {profile.bio}
          </p>
        ) : null}

        {/* Contact + social links */}
        {(links.length > 0 ||
          profile.instagram_handle ||
          profile.phone_number ||
          profile.website_url) ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {profile.website_url ? (
              <a
                href={
                  profile.website_url.startsWith("http")
                    ? profile.website_url
                    : `https://${profile.website_url}`
                }
                target="_blank"
                rel="noreferrer noopener"
                className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition hover:border-brand-orange/40 hover:bg-white/10"
              >
                <Globe
                  className="h-3.5 w-3.5 transition group-hover:text-brand-orange"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                Website
              </a>
            ) : null}
            {profile.phone_number ? (
              <a
                href={`tel:${profile.phone_number}`}
                aria-label={`Call ${profile.phone_number}`}
                className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition hover:border-brand-orange/40 hover:bg-white/10"
              >
                <Phone
                  className="h-3.5 w-3.5 transition group-hover:text-brand-orange"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                Call
              </a>
            ) : null}
            {profile.instagram_handle ? (
              <a
                href={`https://instagram.com/${profile.instagram_handle.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer noopener"
                className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition hover:border-brand-orange/40 hover:bg-white/10"
              >
                <Camera
                  className="h-3.5 w-3.5 transition group-hover:text-brand-orange"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                @{profile.instagram_handle.replace(/^@/, "")}
              </a>
            ) : null}
            {links.map((link) => {
              const Icon = PLATFORM_ICONS[link.platform] ?? ExternalLink;
              return (
                <a
                  key={`${link.platform}-${link.url}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition hover:border-brand-orange/40 hover:bg-white/10"
                >
                  <Icon
                    className="h-3.5 w-3.5 transition group-hover:text-brand-orange"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {PLATFORM_LABELS[link.platform] ?? link.platform}
                </a>
              );
            })}
          </div>
        ) : null}

        {/* Player-type-specific details */}
        {details ? (
          <DetailsBlock playerType={playerType} details={details} />
        ) : null}

        {/* Gallery */}
        {gallery.length > 0 ? (
          <section className="mt-12">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-orange">
              Gallery
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {gallery.map((g) => {
                const url = publicUrl(supabase, g.storage_path);
                return (
                  <a
                    key={g.id}
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group relative block aspect-square overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-md shadow-black/40 transition duration-300 hover:ring-brand-orange/50 hover:shadow-lg hover:shadow-brand-orange/20"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Gallery"
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                    />
                    {/* Gradient overlay — fades in on hover */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition duration-300 group-hover:opacity-100"
                    />
                    {/* Zoom icon — appears on hover (top-right) */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-brand-orange/90 opacity-0 shadow-lg shadow-black/40 transition duration-300 group-hover:opacity-100"
                    >
                      <ZoomIn
                        className="h-4 w-4 text-white"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Intro video */}
        {videoUrl ? (
          <section className="mt-12">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
              Intro video
            </h2>
            <video
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full max-w-4xl rounded-xl bg-black"
            />
          </section>
        ) : null}

        {/* Owner-only publish CTA */}
        {isOwner && !profile.is_published ? (
          <PublishButton profileId={profile.id} />
        ) : null}

        {/* Live status + Update button (shown once published) */}
        {isOwner && profile.is_published ? (
          <ProfileLiveStatus profileId={profile.id} />
        ) : null}
        </section>
      </div>
    </main>
  );
}

function publicUrl(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  path: string,
): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}

function pickDetailName(
  playerType: PlayerType,
  details: Record<string, unknown> | null,
): string | null {
  if (!details) return null;
  switch (playerType) {
    case "band":
      return (details.band_name as string) ?? null;
    case "venue":
      return (details.venue_name as string) ?? null;
    case "talent_buyer":
      return (details.company_name as string) ?? null;
    case "record_label":
      return (details.label_name as string) ?? null;
    case "festival":
      return (details.festival_name as string) ?? null;
    default:
      return null;
  }
}

function DetailsBlock({
  playerType,
  details,
}: {
  playerType: PlayerType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any;
}) {
  const items = pickDetailItems(playerType, details);
  if (items.length === 0) return null;

  // Money-related labels get emerald + larger value + dollar icon
  const isMoney = (label: string) =>
    /booking fee|pays bands|service fee|artist budget|pay/i.test(label);

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-orange">
        Details
      </h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const money = isMoney(item.label);
          return (
            <div
              key={item.label}
              className={`rounded-2xl border bg-gradient-to-br p-5 shadow-md shadow-black/30 transition hover:border-brand-orange/30 ${
                money
                  ? "border-emerald-500/30 from-emerald-500/[.07] via-white/[.03] to-transparent"
                  : "border-white/15 from-white/[.05] via-white/[.03] to-transparent"
              }`}
            >
              <dt
                className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${
                  money ? "text-emerald-300" : "text-brand-orange"
                }`}
              >
                {money ? (
                  <DollarSign
                    className="h-3.5 w-3.5"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                ) : null}
                {item.label}
              </dt>
              <dd
                className={`mt-2 ${
                  money
                    ? "text-2xl font-bold text-emerald-300"
                    : "text-base font-semibold text-white"
                }`}
              >
                {item.value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function pickDetailItems(
  playerType: PlayerType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: any,
): { label: string; value: string }[] {
  const list: { label: string; value: string }[] = [];
  const push = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      list.push({ label, value: value.join(", ") });
      return;
    }
    list.push({ label, value: String(value) });
  };

  // Format a min/max range as "$200–$800"
  const range = (min: unknown, max: unknown) => {
    const hasMin = min !== null && min !== undefined && min !== "";
    const hasMax = max !== null && max !== undefined && max !== "";
    if (hasMin && hasMax) return `$${min}–$${max}`;
    if (hasMin) return `From $${min}`;
    if (hasMax) return `Up to $${max}`;
    return null;
  };

  switch (playerType) {
    case "band":
      push("Genres", d.genres);
      push("Members", d.member_count);
      push("Sound", d.sound_description);
      push(
        "Set length",
        d.set_length_minutes ? `${d.set_length_minutes} min` : null,
      );
      push("Booking email", d.booking_email);
      push("Booking fee", range(d.booking_fee_min, d.booking_fee_max));
      break;
    case "venue":
      push("Venue type", labelize(d.venue_type));
      push("Capacity", d.capacity);
      push("Age restriction", labelize(d.age_restriction));
      push("Genres hosted", d.genres_hosted);
      push("Shows / week", d.shows_per_week);
      push("Booking contact", d.booking_contact_name);
      push("Booking email", d.booking_contact_email);
      push("Pay structure", labelize(d.pay_structure));
      push("Pays bands", range(d.pay_min, d.pay_max));
      break;
    case "talent_buyer":
      push("Company type", labelize(d.company_type));
      push("Genres focus", d.genres_focus);
      push("Service fee", d.typical_booking_fee);
      push(
        "Booking radius",
        d.booking_radius_miles ? `${d.booking_radius_miles} mi` : null,
      );
      push("Contact email", d.contact_email);
      push("Artist budget", range(d.artist_budget_min, d.artist_budget_max));
      push("Events / year", d.events_per_year);
      break;
    case "record_label":
      push("Label type", labelize(d.label_type));
      push("Genres focus", d.genres_focus);
      push("Artists signed", d.artists_signed);
      push("Submissions", d.submission_email);
      push("Deal types", (d.deal_types ?? []).map(labelize).filter(Boolean));
      push("Looking for", d.looking_for);
      break;
    case "festival":
      push("Festival type", labelize(d.festival_type));
      push("When", labelize(d.festival_season));
      push("Genres featured", d.genres_featured);
      push("Expected attendance", d.expected_attendance);
      push("Total band slots", d.total_band_slots);
      push("Apply at", d.application_email);
      push(
        "Pays bands",
        d.pays_bands === true
          ? range(d.pay_min, d.pay_max) ?? "Yes"
          : d.pays_bands === false
            ? "No — exposure only"
            : null,
      );
      break;
  }
  return list;
}

// Convert snake_case enum values to readable labels: "all_ages" → "All ages"
function labelize(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
