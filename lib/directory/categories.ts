/**
 * The 8 directory categories, their URL slugs, and their display/SEO copy.
 *
 * The first five values are byte-identical to `PlayerType` in lib/types.ts on
 * purpose: when a directory listing gets claimed by a real SplitMic account,
 * its category maps 1:1 onto that profile's player_type with no translation.
 */

export type DirectoryCategory =
  | "venue"
  | "record_label"
  | "talent_buyer"
  | "festival"
  | "band"
  | "instrument_rental"
  | "rehearsal_studio"
  | "backline";

export type CategoryMeta = {
  slug: string;
  label: string;
  plural: string;
  /** The exact string used in the scraped CSV's Category column. */
  csvLabel: string;
  /** <h1> and <title> text — this is the keyword the page targets. */
  seoTitle: string;
  blurb: string;
  /**
   * Tile photo, shared with the landing page's player cards so the two read as
   * the same product. Only the five categories that map onto a SplitMic player
   * type have one; the rest fall back to a brand gradient.
   */
  image?: string;
};

export const CATEGORY_META: Record<DirectoryCategory, CategoryMeta> = {
  venue: {
    slug: "venues",
    label: "Venue",
    plural: "Venues",
    csvLabel: "Venues",
    seoTitle: "Austin Music Venues",
    blurb:
      "Clubs, dancehalls, concert halls, and amphitheaters booking live music across Austin.",
    image: "/players/venue.jpg",
  },
  record_label: {
    slug: "record-labels",
    label: "Record Label",
    plural: "Record Labels",
    csvLabel: "Record Labels",
    seoTitle: "Austin Record Labels",
    blurb: "Independent labels signing and releasing Austin artists.",
    image: "/players/record_label.jpg",
  },
  talent_buyer: {
    slug: "talent-buyers",
    label: "Talent Buyer",
    plural: "Talent Buyers",
    csvLabel: "Talent Buyers",
    seoTitle: "Austin Talent Buyers & Booking Agents",
    blurb:
      "The people who book the shows: talent buyers, booking agents, and promoters working in Austin.",
    image: "/players/talent_buyer.jpg",
  },
  festival: {
    slug: "festivals",
    label: "Festival",
    plural: "Festivals",
    csvLabel: "Festivals",
    seoTitle: "Austin Music Festivals",
    blurb: "Music festivals and multi-day events happening in and around Austin.",
    image: "/players/festival.jpg",
  },
  band: {
    slug: "bands",
    label: "Band",
    plural: "Bands",
    csvLabel: "Bands",
    seoTitle: "Austin Bands & Local Artists",
    blurb: "Active Austin bands and artists, by genre.",
    image: "/players/band.jpg",
  },
  instrument_rental: {
    slug: "instrument-rental",
    label: "Instrument Rental",
    plural: "Instrument Rental",
    csvLabel: "Instrument Rental",
    seoTitle: "Austin Instrument Rental",
    blurb: "Where to rent instruments and gear in Austin.",
  },
  rehearsal_studio: {
    slug: "rehearsal-studios",
    label: "Rehearsal Studio",
    plural: "Rehearsal Studios",
    csvLabel: "Rehearsal Studios",
    seoTitle: "Austin Rehearsal Studios",
    blurb: "Hourly and monthly rehearsal rooms and practice spaces in Austin.",
  },
  backline: {
    slug: "backline",
    label: "Backline",
    plural: "Backline Companies",
    csvLabel: "Backline Companies",
    seoTitle: "Austin Backline Rental Companies",
    blurb: "Backline rental and stage gear providers serving Austin shows.",
  },
};

/** Display order — biggest/most-searched categories first. */
export const DIRECTORY_CATEGORIES: readonly DirectoryCategory[] = [
  "venue",
  "band",
  "talent_buyer",
  "record_label",
  "festival",
  "rehearsal_studio",
  "instrument_rental",
  "backline",
] as const;

const CSV_LABEL_LOOKUP = new Map<string, DirectoryCategory>(
  DIRECTORY_CATEGORIES.map((c) => [
    CATEGORY_META[c].csvLabel.toLowerCase(),
    c,
  ]),
);

const SLUG_LOOKUP = new Map<string, DirectoryCategory>(
  DIRECTORY_CATEGORIES.map((c) => [CATEGORY_META[c].slug, c]),
);

/** Maps a CSV Category cell to an enum value. Case- and space-insensitive. */
export function categoryFromCsvLabel(raw: string): DirectoryCategory | null {
  return CSV_LABEL_LOOKUP.get(raw.trim().toLowerCase()) ?? null;
}

/** Maps a URL slug (e.g. "record-labels") to an enum value. */
export function categoryFromSlug(slug: string): DirectoryCategory | null {
  return SLUG_LOOKUP.get(slug.trim().toLowerCase()) ?? null;
}
