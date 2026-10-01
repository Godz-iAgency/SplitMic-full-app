import type { ProfilePayload } from "@/components/onboarding/ProfileStep";
import {
  BACKLINE_EQUIPMENT,
  RENTAL_INSTRUMENTS,
  RENTAL_PERIODS,
  STUDIO_GEAR,
  pickKnown,
} from "@/lib/profile/vendorOptions";

/**
 * The detail-table row (band_details, venue_details, ...) for a profile form
 * payload. Onboarding writes it from the browser and the editor writes it from
 * a server action; both build it here so the two can't drift apart, which they
 * had to be kept from doing by hand before.
 *
 * Social URLs are not in detail tables: they live in `profile_links` as
 * separate rows (see lib/profile/socialLinks.ts).
 */
export function buildDetailRow(
  profileId: string,
  userId: string,
  payload: ProfilePayload,
) {
  const base = { profile_id: profileId, user_id: userId };

  // "" means "left blank" in a number field; the column wants NULL.
  const num = (v: number | "") => (v === "" ? null : v);
  // "" means "not answered"; a yes/no column wants NULL, not false.
  const yesNo = (v: "" | "yes" | "no") => (v === "" ? null : v === "yes");
  const text = (v: string) => v.trim() || null;

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
        pays_bands: yesNo(payload.specific.pays_bands),
        pay_min: num(payload.specific.pay_min),
        pay_max: num(payload.specific.pay_max),
      };
    // Vendor chip lists go through pickKnown: they arrive from the browser, so
    // anything outside the option list is dropped rather than stored.
    case "backline":
      return {
        ...base,
        business_name: payload.specific.business_name.trim(),
        equipment: pickKnown(BACKLINE_EQUIPMENT, payload.specific.equipment),
        delivers: yesNo(payload.specific.delivers),
        service_area: text(payload.specific.service_area),
        price_note: text(payload.specific.price_note),
      };
    case "instrument_rental":
      return {
        ...base,
        business_name: payload.specific.business_name.trim(),
        instruments: pickKnown(RENTAL_INSTRUMENTS, payload.specific.instruments),
        rental_periods: pickKnown(RENTAL_PERIODS, payload.specific.rental_periods),
        delivers: yesNo(payload.specific.delivers),
        price_note: text(payload.specific.price_note),
      };
    case "rehearsal_studio":
      return {
        ...base,
        business_name: payload.specific.business_name.trim(),
        room_count: num(payload.specific.room_count),
        gear_included: pickKnown(STUDIO_GEAR, payload.specific.gear_included),
        rate_note: text(payload.specific.rate_note),
        max_people_per_room: num(payload.specific.max_people_per_room),
        hours_note: text(payload.specific.hours_note),
      };
  }
}
