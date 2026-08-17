import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus, tableForPlayerType } from "@/lib/supabase/profile";
import { computeBandReadiness } from "@/lib/scoring/bandReadiness";
import { Logo } from "@/components/Logo";
import type { MediaRow } from "@/components/profile/MediaManager";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import type { PlayerType } from "@/lib/types";
import type { CommonFieldValues } from "@/components/onboarding/forms/CommonFields";
import type { BandFormValues } from "@/components/onboarding/forms/BandForm";
import type { VenueFormValues } from "@/components/onboarding/forms/VenueForm";
import type { TalentBuyerFormValues } from "@/components/onboarding/forms/TalentBuyerForm";
import type { RecordLabelFormValues } from "@/components/onboarding/forms/RecordLabelForm";
import type { FestivalFormValues } from "@/components/onboarding/forms/FestivalForm";

export const dynamic = "force-dynamic";

export default async function ProfileEditPage({
  searchParams,
}: {
  searchParams: { welcome?: string };
}) {
  const supabase = createServerSupabaseClient();
  const isPostOnboarding = searchParams?.welcome === "1";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!isComplete || !profile?.profile_id) redirect("/onboarding");

  const profileId = profile.profile_id!;
  const playerType = profile.player_type as PlayerType;

  // Fetch media, detail row, links, and the intro video link in parallel
  const [mediaResult, detailResult, linksResult, ownerResult, videoResult] =
    await Promise.all([
      supabase
        .from("profile_media")
        .select("id, kind, storage_path, duration_seconds, created_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: true }),
      supabase
        .from(tableForPlayerType(playerType))
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle(),
      supabase
        .from("profile_links")
        .select("platform, url")
        .eq("profile_id", profileId),
      supabase
        .from("users")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
      // Fetched separately rather than widening getOnboardingStatus's shared
      // UserProfile type, which every authenticated page depends on.
      supabase
        .from("profiles")
        .select("intro_video_url")
        .eq("id", profileId)
        .maybeSingle(),
    ]);

  const media: MediaRow[] = (mediaResult.data ?? []) as MediaRow[];
  const introVideoUrl: string | null = videoResult.data?.intro_video_url ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details: any = detailResult.data ?? {};
  const links = linksResult.data ?? [];
  const fullName = ownerResult.data?.full_name ?? "";

  // ── Map DB → form values ──────────────────────────────────────────────────

  // Extract twitter handle from profile_links
  const twitterLink = links.find((l) => l.platform === "twitter");
  const twitterHandle = twitterLink
    ? twitterLink.url.replace(/^https?:\/\/(x|twitter)\.com\/@?/, "")
    : "";

  const initialCommon: CommonFieldValues = {
    full_name: fullName,
    // Smart default: a bio is never empty on first visit if we already know
    // their genres — a plausible starting point beats a blank textarea. Only
    // fires when bio has truly never been set (an explicitly-cleared "" bio
    // is left alone, since that's a deliberate choice, not an unset one).
    bio: profile.bio ?? buildDefaultBio(playerType, details, profile.city),
    phone_number: profile.phone_number ?? "",
    website_url: profile.website_url ?? "",
    instagram_handle: profile.instagram_handle ?? "",
    instagram_followers: profile.instagram_followers ?? "",
    twitter_handle: twitterHandle,
  };

  const initialSpecific = buildInitialSpecific(playerType, details, links);

  // Goal gradient: bands see their Readiness Score immediately after
  // onboarding — each photo/field added visibly moves them toward 10.
  let readinessScore: number | null = null;
  if (playerType === "band") {
    readinessScore = computeBandReadiness({
      bio: profile.bio ?? null,
      instagram_followers:
        typeof profile.instagram_followers === "number"
          ? profile.instagram_followers
          : null,
      hasAvatar: media.some((m) => m.kind === "avatar"),
      genres: details.genres ?? [],
      sound_description: details.sound_description ?? null,
      set_length_minutes: details.set_length_minutes ?? null,
      email_list_size: details.email_list_size ?? null,
      typical_draw: details.typical_draw ?? null,
      largest_venue_capacity: details.largest_venue_capacity ?? null,
      tiktok_followers: details.tiktok_followers ?? null,
      youtube_followers: details.youtube_followers ?? null,
    }).score;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black">
      <header className="flex items-center justify-between border-b border-white/10 shadow-sm shadow-black/40 px-5 py-4 sm:px-8">
        <Logo className="text-2xl" />
        <Link
          href={`/profile/${profileId}`}
          className="text-sm font-medium text-brand-gray-300 hover:text-white"
        >
          ← Back
        </Link>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14 space-y-16">

        {/* ── Welcome banner (post-onboarding only) ─────────────────── */}
        {isPostOnboarding ? (
          <div className="-mb-8 rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-orange" />
              <div>
                <p className="text-base font-semibold text-white sm:text-lg">
                  Last step: add your photos &amp; video
                </p>
                <p className="mt-1 text-sm text-brand-gray-200">
                  Profiles with a banner, avatar, and intro video get noticed
                  by the Austin music scene. Add yours below, we'll publish
                  your profile as soon as you're done.
                </p>
                {readinessScore !== null ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-orange/15 px-3 py-1 text-xs font-bold text-brand-orange">
                    Band Readiness Score: {readinessScore}/10
                    {readinessScore < 10
                      ? ", adding a photo moves it up"
                      : ""}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Photos & video + Profile info — wrapped together so either
            section's finish button saves the info form before navigating. */}
        <ProfileEditor
          userId={user.id}
          profileId={profileId}
          media={media}
          introVideoUrl={introVideoUrl}
          playerType={playerType}
          initialCommon={initialCommon}
          initialSpecific={initialSpecific}
          autoPublishOnSave={isPostOnboarding}
        />

      </div>
    </main>
  );
}

// Smart default for a never-set bio: build one line from genres the profile
// already picked during onboarding, instead of leaving the field blank.
// Returns "" (no default) if there are no genres to draw from yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDefaultBio(playerType: PlayerType, d: any, city: string | null): string {
  const genreField: Record<PlayerType, string> = {
    band: "genres",
    venue: "genres_hosted",
    talent_buyer: "genres_focus",
    record_label: "genres_focus",
    festival: "genres_featured",
  };
  const genres: string[] = d[genreField[playerType]] ?? [];
  if (genres.length === 0) return "";
  const list = genres.slice(0, 2).join("/");
  // Members can be anywhere in Texas (see lib/address/texas.ts) — the bio
  // should say where *they* are, not assume Austin. Falls back to "Austin"
  // only for pre-existing rows saved before city became a required field.
  const place = city || "Austin";

  switch (playerType) {
    case "band":
      return `${place} ${list} act.`;
    case "venue":
      return `${place} venue hosting ${list} acts.`;
    case "talent_buyer":
      return `Booking ${list} acts around ${place}.`;
    case "record_label":
      return `${place} label scouting ${list} acts.`;
    case "festival":
      return `${place} festival featuring ${list} acts.`;
  }
}

// ── Map detail DB row → typed form values ────────────────────────────────────

function buildInitialSpecific(
  playerType: PlayerType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: any,
  links: { platform: string; url: string }[],
) {
  const n = (v: number | null | undefined): number | "" => v ?? "";

  switch (playerType) {
    case "band": {
      const spotify = links.find((l) => l.platform === "spotify")?.url ?? "";
      const youtube = links.find((l) => l.platform === "youtube")?.url ?? "";
      const tiktokLink = links.find((l) => l.platform === "tiktok")?.url ?? "";
      const tiktokHandle = tiktokLink
        ? tiktokLink.replace(/^https?:\/\/tiktok\.com\/@?/, "")
        : "";
      const facebook = links.find((l) => l.platform === "facebook")?.url ?? "";

      return {
        band_name: d.band_name ?? "",
        genres: d.genres ?? [],
        member_count: n(d.member_count),
        sound_description: d.sound_description ?? "",
        set_length_minutes: n(d.set_length_minutes),
        typical_draw: d.typical_draw ?? "",
        email_list_size: n(d.email_list_size),
        largest_venue_capacity: d.largest_venue_capacity ?? "",
        tiktok_followers: n(d.tiktok_followers),
        youtube_followers: n(d.youtube_followers),
        booking_email: d.booking_email ?? "",
        booking_fee_min: n(d.booking_fee_min),
        booking_fee_max: n(d.booking_fee_max),
        spotify_artist_url: spotify,
        youtube_channel_url: youtube,
        tiktok_handle: tiktokHandle,
        facebook_url: facebook,
      } satisfies BandFormValues;
    }

    case "venue":
      return {
        venue_name: d.venue_name ?? "",
        venue_type: d.venue_type ?? "",
        capacity: n(d.capacity),
        age_restriction: d.age_restriction ?? "",
        genres_hosted: d.genres_hosted ?? [],
        shows_per_week: n(d.shows_per_week),
        booking_contact_name: d.booking_contact_name ?? "",
        booking_contact_email: d.booking_contact_email ?? "",
        pay_structure: d.pay_structure ?? "",
        pay_min: n(d.pay_min),
        pay_max: n(d.pay_max),
      } satisfies VenueFormValues;

    case "talent_buyer":
      return {
        company_name: d.company_name ?? "",
        company_type: d.company_type ?? "",
        genres_focus: d.genres_focus ?? [],
        typical_booking_fee: d.typical_booking_fee ?? "",
        booking_radius_miles: n(d.booking_radius_miles),
        contact_email: d.contact_email ?? "",
        artist_budget_min: n(d.artist_budget_min),
        artist_budget_max: n(d.artist_budget_max),
        events_per_year: n(d.events_per_year),
      } satisfies TalentBuyerFormValues;

    case "record_label":
      return {
        label_name: d.label_name ?? "",
        label_type: d.label_type ?? "",
        genres_focus: d.genres_focus ?? [],
        artists_signed: n(d.artists_signed),
        submission_email: d.submission_email ?? "",
        deal_types: d.deal_types ?? [],
        looking_for: d.looking_for ?? "",
      } satisfies RecordLabelFormValues;

    case "festival":
      return {
        festival_name: d.festival_name ?? "",
        festival_type: d.festival_type ?? "",
        festival_season: d.festival_season ?? "",
        genres_featured: d.genres_featured ?? [],
        expected_attendance: n(d.expected_attendance),
        total_band_slots: n(d.total_band_slots),
        application_email: d.application_email ?? "",
        pays_bands:
          d.pays_bands === true ? "yes" : d.pays_bands === false ? "no" : "",
        pay_min: n(d.pay_min),
        pay_max: n(d.pay_max),
      } satisfies FestivalFormValues;
  }
}
