import { describe, it, expect } from "vitest";
import { validateProfilePayload } from "./validation";
import type { CommonFieldValues } from "@/components/onboarding/forms/CommonFields";
import { EMPTY_SOCIAL_VALUES } from "./socialLinks";
import type { ProfilePayload } from "@/components/onboarding/ProfileStep";
import type { CorePlayerType } from "@/lib/types";

const COMMON: CommonFieldValues = {
  ...EMPTY_SOCIAL_VALUES,
  full_name: "QA Tester",
  bio: "",
  phone_number: "",
  website_url: "",
  instagram_followers: "",
};

function payload(kind: CorePlayerType, genres: string[]): ProfilePayload {
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
  it.each([undefined, null, {}, { kind: "unknown", common: {}, specific: {} }])("rejects malformed payload %j", (value) => {
    expect(validateProfilePayload(value as ProfilePayload)).toBe("Invalid profile details.");
  });

  it.each([undefined, null, "Rock", [""], ["   "], [42]])("rejects malformed genres %j", (genres) => {
    const value = payload("band", genres as string[]);
    expect(validateProfilePayload(value)).toBe("Pick at least one genre.");
  });
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

describe("validateProfilePayload for gear and rehearsal businesses", () => {
  const backline = (equipment: unknown): ProfilePayload => ({
    kind: "backline",
    common: COMMON,
    specific: {
      business_name: "Test Backline",
      equipment: equipment as string[],
      delivers: "yes",
      service_area: "",
      price_note: "",
    },
  });
  const rental = (instruments: unknown): ProfilePayload => ({
    kind: "instrument_rental",
    common: COMMON,
    specific: {
      business_name: "Test Rentals",
      instruments: instruments as string[],
      rental_periods: [],
      delivers: "",
      price_note: "",
    },
  });
  const studio: ProfilePayload = {
    kind: "rehearsal_studio",
    common: COMMON,
    specific: {
      business_name: "Test Rooms",
      room_count: 3,
      gear_included: [],
      rate_note: "",
      max_people_per_room: "",
      hours_note: "",
    },
  };

  it("never asks a vendor for a genre", () => {
    // A rehearsal studio has no genre. Without the exemption every vendor
    // signup would fail on "Pick at least one genre." with no genre field on
    // the form to fix it.
    expect(validateProfilePayload(backline(["drums"]))).toBeNull();
    expect(validateProfilePayload(rental(["guitars"]))).toBeNull();
    expect(validateProfilePayload(studio)).toBeNull();
  });

  it("requires a backline company to say what it provides", () => {
    expect(validateProfilePayload(backline([]))).toBe(
      "Pick at least one thing you provide.",
    );
  });

  it("requires a rental shop to say what it rents", () => {
    expect(validateProfilePayload(rental([]))).toBe(
      "Pick at least one thing you rent.",
    );
  });

  it.each([[["forged"]], [[""]], ["drums"], [null], [[42]]])(
    "does not count values outside the option list (%j)",
    (equipment) => {
      // The chip list arrives from the browser: a made-up value must not
      // satisfy the requirement on its own.
      expect(validateProfilePayload(backline(equipment))).toBe(
        "Pick at least one thing you provide.",
      );
    },
  );

  it("lets a rehearsal studio list no gear (bring-your-own rooms)", () => {
    expect(validateProfilePayload(studio)).toBeNull();
  });
});
