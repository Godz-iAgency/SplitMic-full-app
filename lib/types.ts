/**
 * Businesses that serve a show rather than play or book it. They sign up and
 * get a profile like everyone else, but they never post to the feed and reach
 * people through a Connect request, the same way a band does (PROGRESS.md §2
 * #27). The values are byte-identical to their DirectoryCategory slugs in
 * lib/directory/categories.ts, so a claimed listing maps straight onto one.
 */
export type VendorPlayerType = "backline" | "instrument_rental" | "rehearsal_studio";

/** The five original player types: everyone who plays, books, or signs music. */
export type CorePlayerType =
  | "band"
  | "venue"
  | "talent_buyer"
  | "record_label"
  | "festival";

export type PlayerType = CorePlayerType | VendorPlayerType;

export const VENDOR_PLAYER_TYPES: readonly VendorPlayerType[] = [
  "backline",
  "instrument_rental",
  "rehearsal_studio",
];

export function isVendorPlayerType(t: unknown): t is VendorPlayerType {
  return VENDOR_PLAYER_TYPES.includes(t as VendorPlayerType);
}

// Player-type icons are Lucide components — see components/landing/PlayerTypeIcon.tsx
// (the single source for which icon maps to which player type).
//
// Every type is listed so any label lookup resolves. Pickers that should only
// offer the original five (signup's main list, a post's "who it's for") filter
// with isVendorPlayerType rather than keeping a second list.
export const PLAYER_TYPE_OPTIONS: {
  value: PlayerType;
  label: string;
  description: string;
}[] = [
  {
    value: "band",
    label: "Band / Performer",
    description: "Solo artists, duos, full bands, and DJs based in Austin.",
  },
  {
    value: "venue",
    label: "Venue",
    description: "Clubs, bars, theaters, and rooms hosting live music.",
  },
  {
    value: "talent_buyer",
    label: "Talent Buyer / Booking Agent",
    description: "Bookers, promoters, and event planners curating shows.",
  },
  {
    value: "record_label",
    label: "Record Label",
    description: "Independent and major labels signing Austin artists.",
  },
  {
    value: "festival",
    label: "Festival",
    description: "Multi-day or single-day festivals booking talent.",
  },
  {
    value: "backline",
    label: "Backline Company",
    description: "Drums, amps, PA, and stage gear supplied for shows.",
  },
  {
    value: "instrument_rental",
    label: "Instrument Rental",
    description: "Guitars, keys, drums, and gear to rent by the day or week.",
  },
  {
    value: "rehearsal_studio",
    label: "Rehearsal Studio",
    description: "Practice rooms bands book by the hour or month.",
  },
];

export type CommonProfile = {
  full_name: string;
  phone_number: string;
  bio: string;
  instagram_handle?: string;
  instagram_followers?: number | null;
};

export type BandProfile = CommonProfile & {
  band_name: string;
  genres: string[];
  member_count: number;
  sound_description: string;
  set_length_minutes: number;
};

export type VenueProfile = CommonProfile & {
  venue_name: string;
  capacity: number;
  genres_hosted: string[];
  shows_per_week: number;
  booking_contact_name: string;
  booking_contact_email: string;
};

export type TalentBuyerProfile = CommonProfile & {
  company_name: string;
  company_type: "booking_agent" | "promoter" | "event_planner" | "other";
  genres_focus: string[];
  typical_booking_fee: string;
  booking_radius_miles: number;
};

export type RecordLabelProfile = CommonProfile & {
  label_name: string;
  label_type: "indie" | "major" | "distributed" | "other";
  genres_focus: string[];
  artists_signed: number;
};

export type FestivalProfile = CommonProfile & {
  festival_name: string;
  festival_start_date: string;
  festival_end_date: string;
  genres_featured: string[];
  expected_attendance: number;
  total_band_slots: number;
};

export type AnyProfile =
  | BandProfile
  | VenueProfile
  | TalentBuyerProfile
  | RecordLabelProfile
  | FestivalProfile;
