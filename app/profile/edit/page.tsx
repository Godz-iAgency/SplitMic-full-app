import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus, tableForPlayerType } from "@/lib/supabase/profile";
import { Logo } from "@/components/Logo";
import { MediaManager, type MediaRow } from "@/components/profile/MediaManager";
import { EditInfoForm } from "@/components/profile/EditInfoForm";
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

  // Fetch media, detail row, and links in parallel
  const [mediaResult, detailResult, linksResult, ownerResult] =
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
    ]);

  const media: MediaRow[] = (mediaResult.data ?? []) as MediaRow[];
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
    bio: profile.bio ?? "",
    phone_number: profile.phone_number ?? "",
    website_url: profile.website_url ?? "",
    instagram_handle: profile.instagram_handle ?? "",
    instagram_followers: profile.instagram_followers ?? "",
    twitter_handle: twitterHandle,
  };

  const initialSpecific = buildInitialSpecific(playerType, details, links);

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black">
      <header className="flex items-center justify-between border-b border-white/10 shadow-sm shadow-black/40 px-5 py-4 sm:px-8">
        <Logo className="text-2xl" />
        <Link
          href="/search"
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
                  Almost done — let's add your photos &amp; video
                </p>
                <p className="mt-1 text-sm text-brand-gray-200">
                  Profiles with a banner, avatar, and intro video get noticed
                  by the Austin music scene. Add yours below, then publish
                  when you're ready.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Photos & Video ─────────────────────────────────────────── */}
        <section>
          <div className="mb-8">
            <h1 className="text-3xl font-bold sm:text-4xl">Photos &amp; video</h1>
            <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
              Add a banner, profile photo, up to 3 gallery photos, and a
              15-second intro video.
            </p>
          </div>
          <MediaManager
            userId={user.id}
            profileId={profileId}
            media={media}
          />
        </section>

        {/* ── Profile Info ────────────────────────────────────────────── */}
        <section>
          <div className="mb-8">
            <h1 className="text-3xl font-bold sm:text-4xl">Profile info</h1>
            <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
              Update your bio, contact details, and player-specific information.
              Changes appear on your public profile immediately.
            </p>
          </div>
          <EditInfoForm
            profileId={profileId}
            playerType={playerType}
            initialCommon={initialCommon}
            initialSpecific={initialSpecific}
          />
        </section>

      </div>
    </main>
  );
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
