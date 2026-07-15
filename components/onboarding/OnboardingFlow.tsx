"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { tableForPlayerType } from "@/lib/supabase/profile";
import { normalizeWebsiteUrl } from "@/lib/url";
import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";
import { PlayerTypeStep } from "./PlayerTypeStep";
import { AddressStep, type ValidatedAddress } from "./AddressStep";
import {
  ProfileStep,
  EMPTY_FORM_VALUES,
  type ProfilePayload,
} from "./ProfileStep";
import { ProgressIndicator } from "./ProgressIndicator";
import type { CommonFieldValues } from "./forms/CommonFields";

export type InitialOnboardingState = {
  user_id: string;
  email: string;
  profile_id: string | null;
  player_type: PlayerType | null;
  street_address: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  full_name: string | null;
};

// Account creation counts as step 1 — users arrive with visible progress
// instead of an empty bar (goal-gradient: never start anyone at 0%).
const STEP_LABELS = [
  "Account created",
  "Player type",
  "Austin address",
  "Your profile",
  "Photos & publish",
];

const VALID_PLAYER_TYPES = new Set<string>(
  PLAYER_TYPE_OPTIONS.map((o) => o.value),
);

export function OnboardingFlow({ initial }: { initial: InitialOnboardingState }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientSupabaseClient();

  const [step, setStep] = useState(() => {
    if (initial.player_type && initial.street_address && initial.zip_code)
      return 3;
    if (initial.player_type) return 2;
    return 1;
  });
  const [profileId, setProfileId] = useState<string | null>(initial.profile_id);
  const [playerType, setPlayerType] = useState<PlayerType | null>(
    initial.player_type,
  );
  const [address, setAddress] = useState<ValidatedAddress | null>(
    initial.street_address && initial.zip_code
      ? {
          street_address: initial.street_address,
          address_line_2: initial.address_line_2,
          city: "Austin",
          state: "TX",
          zip_code: initial.zip_code,
          formatted_address: [
            initial.street_address,
            initial.address_line_2,
            "Austin, TX",
            initial.zip_code,
          ]
            .filter(Boolean)
            .join(", "),
        }
      : null,
  );

  const [common, setCommon] = useState<CommonFieldValues>({
    ...EMPTY_FORM_VALUES.common,
    full_name: initial.full_name ?? "",
  });
  const [specific, setSpecific] = useState<ProfilePayload["specific"] | null>(
    null,
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-pre-select the player type if the user clicked a card on the
  // landing page. Source of truth: URL ?type=band, with a localStorage
  // fallback so the choice survives the email-confirmation auth flow.
  const autoSelectAttempted = useRef(false);
  useEffect(() => {
    if (autoSelectAttempted.current) return;
    if (initial.player_type) return; // already chose before
    if (playerType) return; // user already picked in-session

    const fromUrl = searchParams.get("type");
    let fromStorage: string | null = null;
    try {
      fromStorage = localStorage.getItem("splitmic_pending_type");
    } catch {
      // ignore — storage may be disabled
    }
    const candidate = fromUrl || fromStorage;
    if (candidate && VALID_PLAYER_TYPES.has(candidate)) {
      autoSelectAttempted.current = true;
      setPlayerType(candidate as PlayerType);
      // Clear the pending type so it doesn't auto-fill on a future visit
      try {
        localStorage.removeItem("splitmic_pending_type");
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // STEP 1: Player type — upsert into profiles table
  async function handlePlayerTypeNext() {
    if (!playerType) return;
    setSaving(true);
    setError(null);
    try {
      // Upsert (insert or update) the profile row for this user + player_type
      const { data, error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: initial.user_id,
            player_type: playerType,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,player_type" },
        )
        .select("id")
        .single();

      if (upsertError) {
        setError(`Could not save player type: ${upsertError.message}`);
        return;
      }
      if (!data) {
        setError(
          "Could not save player type. Sign out and back in, then try again.",
        );
        return;
      }
      setProfileId(data.id);
      setStep(2);
    } finally {
      setSaving(false);
    }
  }

  // STEP 2: Address — update the profiles row
  async function handleAddressConfirmed(validated: ValidatedAddress) {
    if (!profileId) {
      setError("Missing profile. Go back and select your player type again.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          street_address: validated.street_address,
          address_line_2: validated.address_line_2,
          city: validated.city,
          state: validated.state,
          zip_code: validated.zip_code,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)
        .eq("user_id", initial.user_id)
        .select("id");

      if (updateError) {
        setError(`Could not save address: ${updateError.message}`);
        return;
      }
      if (!data || data.length === 0) {
        setError(
          "Could not save address: profile row not found. Sign out and back in, then try again.",
        );
        return;
      }
      setAddress(validated);
      setStep(3);
    } finally {
      setSaving(false);
    }
  }

  // STEP 3: Profile details — update profiles, upsert detail table, replace links, update users
  async function handleProfileSubmit(payload: ProfilePayload) {
    if (!playerType || !profileId) return;
    setSaving(true);
    setError(null);
    try {
      // 3a. Update the profiles row with bio + common contact fields + instagram
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          bio: payload.common.bio,
          phone_number: payload.common.phone_number || null,
          website_url: normalizeWebsiteUrl(payload.common.website_url),
          instagram_handle: payload.common.instagram_handle || null,
          instagram_followers:
            payload.common.instagram_followers === ""
              ? null
              : payload.common.instagram_followers,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)
        .eq("user_id", initial.user_id);

      if (profileError) {
        setError(`Could not save profile: ${profileError.message}`);
        return;
      }

      // 3b. Upsert detail table (band_details, venue_details, etc.)
      const tableName = tableForPlayerType(playerType);
      const detailRow = buildDetailRow(profileId, initial.user_id, payload);

      const { error: detailError } = await supabase
        .from(tableName)
        .upsert(detailRow, { onConflict: "profile_id" });
      if (detailError) {
        setError(`Could not save details: ${detailError.message}`);
        return;
      }

      // 3c. Replace profile_links (social URLs)
      const links = buildProfileLinks(profileId, payload);
      // Wipe existing links for this profile, then insert fresh
      await supabase.from("profile_links").delete().eq("profile_id", profileId);
      if (links.length > 0) {
        const { error: linksError } = await supabase
          .from("profile_links")
          .insert(links);
        if (linksError) {
          setError(`Could not save social links: ${linksError.message}`);
          return;
        }
      }

      // 3d. Update users.full_name
      const { error: userError } = await supabase
        .from("users")
        .update({
          full_name: payload.common.full_name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", initial.user_id);
      if (userError) {
        setError(`Saved details but could not finalize: ${userError.message}`);
        return;
      }

      router.replace("/profile/edit?welcome=1");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-10 sm:px-8 sm:py-14">
      {/* step+1: account creation is the already-completed first step */}
      <ProgressIndicator
        currentStep={step + 1}
        totalSteps={5}
        labels={STEP_LABELS}
      />
      <p className="mb-6 text-xs text-brand-gray-400">
        <span className="font-semibold text-brand-orange">
          ✓ Account created.
        </span>{" "}
        About 3 minutes to a live profile.
      </p>

      {step === 1 ? (
        <PlayerTypeStep
          selected={playerType}
          onSelect={setPlayerType}
          onNext={handlePlayerTypeNext}
          saving={saving}
          error={error}
        />
      ) : null}

      {step === 2 ? (
        <AddressStep
          initial={address}
          saving={saving}
          parentError={error}
          onBack={() => {
            setError(null);
            setStep(1);
          }}
          onConfirmed={handleAddressConfirmed}
        />
      ) : null}

      {step === 3 && playerType ? (
        <ProfileStep
          playerType={playerType}
          initialCommon={common}
          initialSpecific={specific}
          saving={saving}
          error={error}
          onCommonChange={setCommon}
          onSpecificChange={setSpecific}
          onBack={() => {
            setError(null);
            setStep(2);
          }}
          onSubmit={handleProfileSubmit}
        />
      ) : null}
    </main>
  );
}

// Build the detail-table row (band_details, venue_details, etc.).
// NOTE: social URLs (spotify, youtube, tiktok) are NOT in detail tables anymore;
// they live in `profile_links` as separate rows.
function buildDetailRow(
  profileId: string,
  userId: string,
  payload: ProfilePayload,
) {
  const base = {
    profile_id: profileId,
    user_id: userId,
  };

  // Helper: convert "" to null for nullable numeric fields
  const num = (v: number | "") => (v === "" ? null : v);

  switch (payload.kind) {
    case "band":
      return {
        ...base,
        band_name: payload.specific.band_name,
        genres: payload.specific.genres,
        member_count: num(payload.specific.member_count),
        sound_description: payload.specific.sound_description,
        set_length_minutes: num(payload.specific.set_length_minutes),
        typical_draw: payload.specific.typical_draw || null,
        email_list_size: num(payload.specific.email_list_size),
        largest_venue_capacity: payload.specific.largest_venue_capacity || null,
        tiktok_followers: num(payload.specific.tiktok_followers),
        youtube_followers: num(payload.specific.youtube_followers),
        booking_email: payload.specific.booking_email || null,
        booking_fee_min: num(payload.specific.booking_fee_min),
        booking_fee_max: num(payload.specific.booking_fee_max),
      };
    case "venue":
      return {
        ...base,
        venue_name: payload.specific.venue_name,
        venue_type: payload.specific.venue_type || null,
        capacity: num(payload.specific.capacity),
        age_restriction: payload.specific.age_restriction || null,
        genres_hosted: payload.specific.genres_hosted,
        shows_per_week: num(payload.specific.shows_per_week),
        booking_contact_name: payload.specific.booking_contact_name,
        booking_contact_email: payload.specific.booking_contact_email,
        pay_structure: payload.specific.pay_structure || null,
        pay_min: num(payload.specific.pay_min),
        pay_max: num(payload.specific.pay_max),
      };
    case "talent_buyer":
      return {
        ...base,
        company_name: payload.specific.company_name,
        company_type: payload.specific.company_type,
        genres_focus: payload.specific.genres_focus,
        typical_booking_fee: payload.specific.typical_booking_fee,
        booking_radius_miles: num(payload.specific.booking_radius_miles),
        contact_email: payload.specific.contact_email,
        artist_budget_min: num(payload.specific.artist_budget_min),
        artist_budget_max: num(payload.specific.artist_budget_max),
        events_per_year: num(payload.specific.events_per_year),
      };
    case "record_label":
      return {
        ...base,
        label_name: payload.specific.label_name,
        label_type: payload.specific.label_type,
        genres_focus: payload.specific.genres_focus,
        artists_signed: num(payload.specific.artists_signed),
        submission_email: payload.specific.submission_email,
        deal_types:
          payload.specific.deal_types.length > 0
            ? payload.specific.deal_types
            : null,
        looking_for: payload.specific.looking_for || null,
      };
    case "festival":
      return {
        ...base,
        festival_name: payload.specific.festival_name,
        festival_type: payload.specific.festival_type || null,
        festival_season: payload.specific.festival_season || null,
        genres_featured: payload.specific.genres_featured,
        expected_attendance: num(payload.specific.expected_attendance),
        total_band_slots: num(payload.specific.total_band_slots),
        application_email: payload.specific.application_email,
        pays_bands:
          payload.specific.pays_bands === ""
            ? null
            : payload.specific.pays_bands === "yes",
        pay_min: num(payload.specific.pay_min),
        pay_max: num(payload.specific.pay_max),
      };
  }
}

// Build profile_links rows for social URLs.
// All player types: twitter / X (from common fields).
// Bands additionally: spotify, youtube, tiktok, facebook.
function buildProfileLinks(
  profileId: string,
  payload: ProfilePayload,
): Array<{ profile_id: string; platform: string; url: string }> {
  const links: Array<{ profile_id: string; platform: string; url: string }> =
    [];

  // Twitter / X — everyone
  const twitter = payload.common.twitter_handle?.trim();
  if (twitter) {
    const handle = twitter.replace(/^@/, "");
    const url = handle.startsWith("http")
      ? handle
      : `https://x.com/${handle}`;
    links.push({ profile_id: profileId, platform: "twitter", url });
  }

  // Band-only social platforms
  if (payload.kind === "band") {
    const {
      spotify_artist_url,
      youtube_channel_url,
      tiktok_handle,
      facebook_url,
    } = payload.specific;

    if (spotify_artist_url?.trim()) {
      links.push({
        profile_id: profileId,
        platform: "spotify",
        url: spotify_artist_url.trim(),
      });
    }
    if (youtube_channel_url?.trim()) {
      links.push({
        profile_id: profileId,
        platform: "youtube",
        url: youtube_channel_url.trim(),
      });
    }
    if (tiktok_handle?.trim()) {
      const handle = tiktok_handle.trim().replace(/^@/, "");
      const url = handle.startsWith("http")
        ? handle
        : `https://tiktok.com/@${handle}`;
      links.push({ profile_id: profileId, platform: "tiktok", url });
    }
    if (facebook_url?.trim()) {
      links.push({
        profile_id: profileId,
        platform: "facebook",
        url: facebook_url.trim(),
      });
    }
  }

  return links;
}
