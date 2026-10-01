import { describe, expect, it } from "vitest";
import { buildDetailRow } from "./detailRow";
import type { ProfilePayload } from "@/components/onboarding/ProfileStep";
import type { CommonFieldValues } from "@/components/onboarding/forms/CommonFields";
import { EMPTY_SOCIAL_VALUES } from "./socialLinks";

// Local fixtures rather than the form defaults in ProfileStep.tsx: that file is
// a React component, and these tests stay on pure logic.
const COMMON: CommonFieldValues = {
  ...EMPTY_SOCIAL_VALUES,
  full_name: "QA Tester",
  bio: "",
  phone_number: "",
  website_url: "",
  instagram_followers: "",
};
const BACKLINE = {
  business_name: "",
  equipment: [] as string[],
  delivers: "" as const,
  service_area: "",
  price_note: "",
};
const RENTAL = {
  business_name: "",
  instruments: [] as string[],
  rental_periods: [] as string[],
  delivers: "" as const,
  price_note: "",
};
const STUDIO = {
  business_name: "",
  room_count: "" as const,
  gear_included: [] as string[],
  rate_note: "",
  max_people_per_room: "" as const,
  hours_note: "",
};
const FESTIVAL = {
  festival_name: "",
  festival_type: "" as const,
  festival_season: "" as const,
  genres_featured: [] as string[],
  expected_attendance: "" as const,
  total_band_slots: "" as const,
  application_email: "",
  pays_bands: "" as const,
  pay_min: "" as const,
  pay_max: "" as const,
};
const BAND = {
  band_name: "",
  genres: [] as string[],
  member_count: 4,
  sound_description: "",
  set_length_minutes: 45,
  typical_draw: "",
  email_list_size: "" as const,
  largest_venue_capacity: "",
  tiktok_followers: "" as const,
  youtube_followers: "" as const,
  booking_email: "",
  booking_fee_min: "" as const,
  booking_fee_max: "" as const,
};

describe("buildDetailRow for gear and rehearsal businesses", () => {
  it("drops chip values outside the option list before they reach the database", () => {
    // These arrays come straight from the browser. A forged value must never
    // be stored, since every reader trusts the column to hold known slugs.
    const payload: ProfilePayload = {
      kind: "backline",
      common: COMMON,
      specific: {
        ...BACKLINE,
        business_name: "  Loud Gear Co  ",
        equipment: ["drums", "<img onerror=x>", "pa", "drums"],
        delivers: "yes",
      },
    };

    expect(buildDetailRow("p1", "u1", payload)).toEqual({
      profile_id: "p1",
      user_id: "u1",
      business_name: "Loud Gear Co",
      equipment: ["drums", "pa"],
      delivers: true,
      service_area: null,
      price_note: null,
    });
  });

  it("stores an unanswered delivery question as unknown, not as no", () => {
    const payload: ProfilePayload = {
      kind: "instrument_rental",
      common: COMMON,
      specific: {
        ...RENTAL,
        business_name: "Rent-A-Strat",
        instruments: ["guitars"],
        rental_periods: ["weekly", "hourly"],
        delivers: "",
        price_note: "  From $25 a day ",
      },
    };

    expect(buildDetailRow("p1", "u1", payload)).toMatchObject({
      instruments: ["guitars"],
      rental_periods: ["weekly"],
      delivers: null,
      price_note: "From $25 a day",
    });
  });

  it("writes blank studio numbers as NULL", () => {
    const payload: ProfilePayload = {
      kind: "rehearsal_studio",
      common: COMMON,
      specific: {
        ...STUDIO,
        business_name: "Room 9",
        room_count: 3,
        max_people_per_room: "",
        hours_note: "   ",
      },
    };

    expect(buildDetailRow("p1", "u1", payload)).toMatchObject({
      room_count: 3,
      gear_included: [],
      max_people_per_room: null,
      hours_note: null,
      rate_note: null,
    });
  });
});

describe("buildDetailRow for the original five (moved, not changed)", () => {
  it("still maps a festival's yes/no/blank pay answer the same way", () => {
    const festival = (pays_bands: "" | "yes" | "no"): ProfilePayload => ({
      kind: "festival",
      common: COMMON,
      specific: { ...FESTIVAL, festival_name: "Fest", pays_bands },
    });

    expect(buildDetailRow("p", "u", festival("yes"))).toMatchObject({ pays_bands: true });
    expect(buildDetailRow("p", "u", festival("no"))).toMatchObject({ pays_bands: false });
    expect(buildDetailRow("p", "u", festival(""))).toMatchObject({ pays_bands: null });
  });

  it("still writes a band's blank numbers as NULL", () => {
    const payload: ProfilePayload = {
      kind: "band",
      common: COMMON,
      specific: { ...BAND, band_name: "The Test", genres: ["Rock"] },
    };

    expect(buildDetailRow("p", "u", payload)).toMatchObject({
      band_name: "The Test",
      genres: ["Rock"],
      member_count: 4,
      email_list_size: null,
      typical_draw: null,
    });
  });
});
