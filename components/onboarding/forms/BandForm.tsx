"use client";

import { TextField } from "@/components/onboarding/fields/TextField";
import { NumberField } from "@/components/onboarding/fields/NumberField";
import { SelectField } from "@/components/onboarding/fields/SelectField";
import { GenreMultiSelect } from "@/components/onboarding/fields/GenreMultiSelect";
import { Lock } from "lucide-react";
import { DRAW_OPTIONS, VENUE_OPTIONS } from "@/lib/scoring/bandReadiness";

export type BandFormValues = {
  band_name: string;
  genres: string[];
  member_count: number | "";
  sound_description: string;
  set_length_minutes: number | "";
  // Draw & reach (powers the Band Readiness Score)
  typical_draw: string;
  email_list_size: number | "";
  largest_venue_capacity: string;
  tiktok_followers: number | "";
  youtube_followers: number | "";
  // Booking contact
  booking_email: string;
  booking_fee_min: number | "";
  booking_fee_max: number | "";
  // Social links (band-only)
  spotify_artist_url: string;
  youtube_channel_url: string;
  tiktok_handle: string;
  facebook_url: string;
};

type Props = {
  values: BandFormValues;
  onChange: <K extends keyof BandFormValues>(
    key: K,
    value: BandFormValues[K],
  ) => void;
};

export function BandForm({ values, onChange }: Props) {
  return (
    <div className="space-y-4">
      <TextField
        id="band_name"
        label="Band Name"
        value={values.band_name}
        onChange={(v) => onChange("band_name", v)}
        required
      />
      <GenreMultiSelect
        id="genres"
        label="Genres"
        value={values.genres}
        onChange={(v) => onChange("genres", v)}
        required
      />
      <NumberField
        id="member_count"
        label="Member Count"
        value={values.member_count}
        onChange={(v) => onChange("member_count", v)}
        required
        min={1}
        max={50}
      />
      <TextField
        id="sound_description"
        label="One-Sentence Sound Description"
        value={values.sound_description}
        onChange={(v) => onChange("sound_description", v)}
        required
        maxLength={100}
        placeholder="e.g., High-energy rock with indie influences"
        hint={`${values.sound_description.length}/100`}
      />
      <NumberField
        id="set_length_minutes"
        label="Typical Set Length"
        value={values.set_length_minutes}
        onChange={(v) => onChange("set_length_minutes", v)}
        required
        min={1}
        placeholder="e.g., 60"
        hint="minutes, 45 is the typical Austin support slot"
      />

      <div className="pt-2">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
          Draw &amp; Reach
        </h3>
        <p className="mb-3 inline-flex items-start gap-1.5 text-xs text-brand-gray-400">
          <Lock
            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-orange"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>
            These power your <strong className="text-brand-gray-200">Band
            Readiness Score</strong>. Your overall score is public, but this
            breakdown is private. Only you can see it.
          </span>
        </p>
        <div className="space-y-4">
          <SelectField
            id="typical_draw"
            label="Typical Draw: how many people you bring"
            value={values.typical_draw}
            onChange={(v) => onChange("typical_draw", v)}
            options={DRAW_OPTIONS}
            hint="The #1 thing talent buyers ask. Most Austin bands starting out pick 25-75."
          />
          <SelectField
            id="largest_venue_capacity"
            label="Largest Venue You've Played"
            value={values.largest_venue_capacity}
            onChange={(v) => onChange("largest_venue_capacity", v)}
            options={VENUE_OPTIONS}
            hint="By room capacity, your biggest stage so far."
          />
          <NumberField
            id="email_list_size"
            label="Email List Size"
            value={values.email_list_size}
            onChange={(v) => onChange("email_list_size", v)}
            min={0}
            grouped
            placeholder="e.g., 1,200"
            hint="Optional: direct reach to your fans."
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="tiktok_followers"
              label="TikTok Followers"
              value={values.tiktok_followers}
              onChange={(v) => onChange("tiktok_followers", v)}
              min={0}
              grouped
              placeholder="e.g., 5,000"
              hint="Optional"
            />
            <NumberField
              id="youtube_followers"
              label="YouTube Subscribers"
              value={values.youtube_followers}
              onChange={(v) => onChange("youtube_followers", v)}
              min={0}
              grouped
              placeholder="e.g., 3,000"
              hint="Optional"
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
          Booking
        </h3>
        <div className="space-y-4">
          <TextField
            id="booking_email"
            label="Booking Email"
            type="email"
            value={values.booking_email}
            onChange={(v) => onChange("booking_email", v)}
            placeholder="bookings@yourband.com"
            hint="Optional: most venues prefer email over phone"
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="booking_fee_min"
              label="Min Booking Fee ($)"
              value={values.booking_fee_min}
              onChange={(v) => onChange("booking_fee_min", v)}
              min={0}
              placeholder="200"
              hint="Optional"
            />
            <NumberField
              id="booking_fee_max"
              label="Max Booking Fee ($)"
              value={values.booking_fee_max}
              onChange={(v) => onChange("booking_fee_max", v)}
              min={0}
              placeholder="800"
              hint="Optional"
            />
          </div>
          <p className="text-xs text-brand-gray-400">
            This is your typical range, used by venues / talent buyers to
            filter. Actual show pay is always negotiated per gig.
          </p>
        </div>
      </div>

      <div className="pt-2">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
          Social Links{" "}
          <span className="text-xs font-normal normal-case text-brand-gray-400">
            (optional)
          </span>
        </h3>
        <div className="space-y-4">
          <TextField
            id="spotify_artist_url"
            label="Spotify Artist URL"
            type="url"
            value={values.spotify_artist_url}
            onChange={(v) => onChange("spotify_artist_url", v)}
            placeholder="https://open.spotify.com/artist/..."
          />
          <TextField
            id="youtube_channel_url"
            label="YouTube Channel URL"
            type="url"
            value={values.youtube_channel_url}
            onChange={(v) => onChange("youtube_channel_url", v)}
            placeholder="https://youtube.com/@yourband"
          />
          <TextField
            id="tiktok_handle"
            label="TikTok Handle"
            value={values.tiktok_handle}
            onChange={(v) =>
              onChange(
                "tiktok_handle",
                v.startsWith("@") ? v.slice(1) : v,
              )
            }
            placeholder="@yourband (without the @)"
          />
          <TextField
            id="facebook_url"
            label="Facebook Page URL"
            type="url"
            value={values.facebook_url}
            onChange={(v) => onChange("facebook_url", v)}
            placeholder="https://facebook.com/yourband"
          />
        </div>
      </div>
    </div>
  );
}
