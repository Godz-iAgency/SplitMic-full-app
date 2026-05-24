export type PlayerType =
  | "band"
  | "venue"
  | "talent_buyer"
  | "record_label"
  | "festival";

export const PLAYER_TYPE_OPTIONS: {
  value: PlayerType;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "band",
    label: "Band / Performer",
    description: "Solo artists, duos, full bands, and DJs based in Austin.",
    icon: "🎸",
  },
  {
    value: "venue",
    label: "Venue",
    description: "Clubs, bars, theaters, and rooms hosting live music.",
    icon: "🏛️",
  },
  {
    value: "talent_buyer",
    label: "Talent Buyer / Booking Agent",
    description: "Bookers, promoters, and event planners curating shows.",
    icon: "📅",
  },
  {
    value: "record_label",
    label: "Record Label",
    description: "Independent and major labels signing Austin artists.",
    icon: "💿",
  },
  {
    value: "festival",
    label: "Festival",
    description: "Multi-day or single-day festivals booking talent.",
    icon: "🎪",
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
