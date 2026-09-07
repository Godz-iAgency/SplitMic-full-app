import { describe, it, expect } from "vitest";
import { validateProfilePayload } from "./validation";
import type { CommonFieldValues } from "@/components/onboarding/forms/CommonFields";
import { EMPTY_SOCIAL_VALUES } from "./socialLinks";
import type { ProfilePayload } from "@/components/onboarding/ProfileStep";

const COMMON: CommonFieldValues = {
  ...EMPTY_SOCIAL_VALUES,
  full_name: "QA Tester",
  bio: "",
  phone_number: "",
  website_url: "",
  instagram_followers: "",
};

function payload(
  kind: ProfilePayload["kind"],
  genres: string[],
): ProfilePayload {
  switch (kind) {
    case "band":
      return {
        kind,
        common: COMMON,
        specific: {
          band_name: "Test Band",
          genres,
          member_count: 4,
          sound_description: "",
          set_length_minutes: "",
          typical_draw: "",
          email_list_size: "",
          largest_venue_capacity: "",
          tiktok_followers: "",
          youtube_followers: "",
          booking_email: "",
          booking_fee_min: "",
          booking_fee_max: "",
        },
      };
    case "venue":
      return {
        kind,
        common: COMMON,
        specific: {
          venue_name: "Test Venue",
          venue_type: "bar",
          capacity: 100,
          age_restriction: "",
          genres_hosted: genres,
          shows_per_week: "",
          booking_contact_name: "",
          booking_contact_email: "",
          pay_structure: "",
          pay_min: "",
          pay_max: "",
        },
      };
    case "talent_buyer":
      return {
        kind,
        common: COMMON,
        specific: {
          company_name: "Test Co",
          company_type: "promoter",
          genres_focus: genres,
          typical_booking_fee: "",
          booking_radius_miles: "",
          contact_email: "",
          artist_budget_min: "",
          artist_budget_max: "",
          events_per_year: "",
        },
      };
    case "record_label":
      return {
        kind,
        common: COMMON,
        specific: {
          label_name: "Test Label",
          label_type: "indie",
          genres_focus: genres,
          artists_signed: 0,
          submission_email: "",
          deal_types: [],
          looking_for: "",
        },
      };
    case "festival":
      return {
        kind,
        common: COMMON,
        specific: {
          festival_name: "Test Fest",
          festival_type: "single_day",
          festival_season: "",
          genres_featured: genres,
          expected_attendance: "",
          total_band_slots: "",
          application_email: "",
          pays_bands: "",
          pay_min: "",
          pay_max: "",
        },
      };
  }
}

describe("validateProfilePayload", () => {
  it("rejects a band with no genres", () => {
    // The regression this guards: onboarding completed end-to-end with zero
    // genres selected, because GenreMultiSelect's `required` prop only draws
    // an asterisk and never enters native form validation. Confirmed live
    // that a real band_details row was written with genres: [] before this.
    expect(validateProfilePayload(payload("band", []))).toBe(
      "Pick at least one genre.",
    );
  });

  it("accepts a band with at least one genre", () => {
    expect(validateProfilePayload(payload("band", ["Reggae"]))).toBeNull();
  });

  it.each([
    ["venue", "genres_hosted"],
    ["talent_buyer", "genres_focus"],
    ["record_label", "genres_focus"],
    ["festival", "genres_featured"],
  ] as const)("checks %s's own genre field (%s)", (kind, _fieldName) => {
    expect(validateProfilePayload(payload(kind, []))).toBe(
      "Pick at least one genre.",
    );
    expect(validateProfilePayload(payload(kind, ["Rock"]))).toBeNull();
  });
});
