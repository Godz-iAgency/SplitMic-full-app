import { describe, it, expect } from "vitest";
import {
  normalizeBusinessName,
  extractPhone,
  normalizeWebsite,
  normalizeEmail,
  splitNotes,
  mapCsvRowToBusiness,
  mapCsvToBusinesses,
} from "./mapRow";
import { categoryFromCsvLabel, categoryFromSlug } from "./categories";
import { DIRECTORY_CSV_HEADERS } from "./csv";

const HEADER = DIRECTORY_CSV_HEADERS.join(",");

describe("normalizeBusinessName", () => {
  it("lowercases and collapses punctuation to single spaces", () => {
    expect(normalizeBusinessName("The 19th Hole @ Putters & Gutters")).toBe(
      "the 19th hole putters gutters",
    );
  });

  it("is idempotent", () => {
    const once = normalizeBusinessName("Antone's Nightclub");
    expect(normalizeBusinessName(once)).toBe(once);
  });

  it("never leaves leading or trailing whitespace", () => {
    expect(normalizeBusinessName("  ...Mohawk!  ")).toBe("mohawk");
  });

  it("keeps non-ASCII names distinct rather than collapsing them together", () => {
    // Lossy (accents become spaces) but deterministic, and these don't collide.
    expect(normalizeBusinessName("Superfónicos")).not.toBe(
      normalizeBusinessName("Austin Acoustical Café"),
    );
  });

  it("does not strip a leading 'The', unlike the fuzzy event matcher", () => {
    // "The Mohawk" and "Mohawk" are potentially different businesses; this is
    // an identity key, so merging them would be wrong.
    expect(normalizeBusinessName("The Mohawk")).not.toBe(
      normalizeBusinessName("Mohawk"),
    );
  });
});

describe("extractPhone", () => {
  // All formats below are real, taken from business_directory_scraped.csv.
  it.each([
    ["Phone 512-750-5846. Serving Central Texas since 2008", "(512) 750-5846"],
    ["Phone (512) 476-6927. South location", "(512) 476-6927"],
    ["Phone 512-339-1276; monthly from $175", "(512) 339-1276"],
    ["Phone 512-444-0023. 3714 Bluestein Drive Suite 600", "(512) 444-0023"],
  ])("extracts from %j", (notes, expected) => {
    expect(extractPhone(notes)).toBe(expected);
  });

  // The false-positive guards matter more than the matches: only 11 of 586
  // rows have a phone, so a loose pattern would invent hundreds of bad ones.
  it.each([
    ["18105 Foust Drive, Buda TX 78610"],
    ["3714 Bluestein Drive Suite 600, Austin TX 78721"],
    ["Spring; Moody Amphitheater at Waterloo Park"],
    ["Genre: Alternative Rock; Active: Spotify shows 2025 album"],
    ["Clubs/Dancehalls/Small Venues"],
    ["monthly from $175 with 24 hour access"],
    [""],
  ])("returns null for %j", (notes) => {
    expect(extractPhone(notes)).toBeNull();
  });

  it("drops a leading country code", () => {
    expect(extractPhone("Phone 1-512-750-5846")).toBe("(512) 750-5846");
  });
});

describe("normalizeWebsite", () => {
  it("preserves a non-www subdomain", () => {
    // Regression guard: normalizeWebsiteUrl() in lib/url.ts force-adds "www.",
    // which would turn this into a hostname that does not resolve. 47+ rows
    // in the scrape are subdomains like this one.
    expect(normalizeWebsite("https://amplifiedheat.bandcamp.com/")).toBe(
      "https://amplifiedheat.bandcamp.com/",
    );
  });

  it("adds https:// to a bare domain", () => {
    expect(normalizeWebsite("stores.guitarcenter.com/austin")).toBe(
      "https://stores.guitarcenter.com/austin",
    );
  });

  it("preserves an http:// URL's scheme and path", () => {
    expect(normalizeWebsite("http://puttersandgutters.com/")).toBe(
      "http://puttersandgutters.com/",
    );
  });

  it.each([
    ["javascript:alert(1)"],
    ["data:text/html,hi"],
    [""],
    ["   "],
    ["not a url at all"],
  ])("returns null for %j", (raw) => {
    expect(normalizeWebsite(raw)).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Booking@Example.COM ")).toBe("booking@example.com");
  });

  it.each([[""], ["not-an-email"], ["a@b"], ["a b@c.com"]])(
    "returns null for %j",
    (raw) => {
      expect(normalizeEmail(raw)).toBeNull();
    },
  );
});

describe("splitNotes", () => {
  it.each([
    ["Clubs/Dancehalls/Small Venues", "Clubs & Small Venues"],
    ["Concert halls/Performing arts centers", "Concert Halls & Performing Arts"],
    ["Stadiums/Amphitheaters/Fairgrounds", "Stadiums & Amphitheaters"],
    ["Auditoriums/Arenas", "Auditoriums & Arenas"],
  ])("maps the venue taxonomy label %j to a subcategory", (notes, expected) => {
    expect(splitNotes("venue", notes)).toEqual({
      description: null,
      subcategory: expected,
    });
  });

  it("treats unrecognized venue notes as a description", () => {
    expect(splitNotes("venue", "Rooftop bar with a small stage")).toEqual({
      description: "Rooftop bar with a small stage",
      subcategory: null,
    });
  });

  it("pulls the genre out of a band's notes", () => {
    const result = splitNotes(
      "band",
      'Genre: Blues Rock / Garage Rock; Active: Spotify shows 2026 single "Schizofrantic Ace"; Contact: Bandcamp + Instagram',
    );
    expect(result.subcategory).toBe("Blues Rock / Garage Rock");
    expect(result.description).toContain("Active:");
    expect(result.description).toContain("Contact:");
  });

  it("pulls the season out of a festival's notes", () => {
    expect(splitNotes("festival", "Spring; Moody Amphitheater at Waterloo Park")).toEqual({
      subcategory: "Spring",
      description: "Moody Amphitheater at Waterloo Park",
    });
  });

  it("falls back to a description when a festival note has no season", () => {
    expect(splitNotes("festival", "Via Music Festival Wizard")).toEqual({
      subcategory: null,
      description: "Via Music Festival Wizard",
    });
  });

  it("removes the phone from the description it leaves behind", () => {
    expect(
      splitNotes("backline", "Phone 512-750-5846. Serving Central Texas since 2008"),
    ).toEqual({
      description: "Serving Central Texas since 2008",
      subcategory: null,
    });
  });

  it("keeps address text after stripping the phone", () => {
    const result = splitNotes(
      "backline",
      "Phone 512-518-5974. 18105 Foust Drive, Buda TX 78610. Official ACL Fest vendor",
    );
    expect(result.description).toBe(
      "18105 Foust Drive, Buda TX 78610. Official ACL Fest vendor",
    );
  });

  it("returns nulls for empty notes", () => {
    expect(splitNotes("venue", "")).toEqual({ description: null, subcategory: null });
  });
});

describe("category lookups", () => {
  it.each([
    ["Venues", "venue"],
    ["Record Labels", "record_label"],
    ["Talent Buyers", "talent_buyer"],
    ["Festivals", "festival"],
    ["Bands", "band"],
    ["Instrument Rental", "instrument_rental"],
    ["Rehearsal Studios", "rehearsal_studio"],
    ["Backline Companies", "backline"],
  ])("maps the CSV label %j", (csvLabel, expected) => {
    expect(categoryFromCsvLabel(csvLabel)).toBe(expected);
  });

  it("ignores surrounding whitespace and case", () => {
    expect(categoryFromCsvLabel("  venues ")).toBe("venue");
  });

  it("returns null for an unknown label", () => {
    expect(categoryFromCsvLabel("Nightclubs")).toBeNull();
  });

  it("maps URL slugs", () => {
    expect(categoryFromSlug("record-labels")).toBe("record_label");
    expect(categoryFromSlug("not-a-category")).toBeNull();
  });
});

describe("mapCsvRowToBusiness", () => {
  it("maps a complete row", () => {
    const result = mapCsvRowToBusiness(
      [
        "Backline Companies",
        "Austin Backline Company",
        "austinbackline@gmail.com",
        "https://www.austinbacklinecompany.com/",
        "Phone 512-750-5846. Serving Central Texas since 2008",
      ],
      2,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      category: "backline",
      business_name: "Austin Backline Company",
      name_key: "austin backline company",
      email: "austinbackline@gmail.com",
      phone: "(512) 750-5846",
      description: "Serving Central Texas since 2008",
    });
  });

  it("keeps the verbatim source row for later reprocessing", () => {
    const result = mapCsvRowToBusiness(["Venues", "Mohawk", "", "", "Notes"], 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.source_row).toEqual({
      Category: "Venues",
      "Business Name": "Mohawk",
      Email: "",
      Website: "",
      Notes: "Notes",
    });
  });

  it("rejects an unknown category", () => {
    const result = mapCsvRowToBusiness(["Nightclubs", "X", "", "", ""], 5);
    expect(result).toMatchObject({ ok: false, line: 5 });
  });

  it("rejects a blank business name", () => {
    const result = mapCsvRowToBusiness(["Venues", "   ", "", "", ""], 7);
    expect(result).toMatchObject({ ok: false, line: 7 });
  });
});

describe("mapCsvToBusinesses", () => {
  it("keeps the first of two rows with the same category and name", () => {
    // Real fixture: this venue is listed under two different venue types.
    const csv = [
      HEADER,
      "Venues,The 19th Hole @ Putters & Gutters,pgmarketing@yahoo.com,http://puttersandgutters.com/,Clubs/Dancehalls/Small Venues",
      "Venues,The 19th Hole @ Putters & Gutters,pgmarketing@yahoo.com,http://puttersandgutters.com/,Stadiums/Amphitheaters/Fairgrounds",
    ].join("\n");

    const result = mapCsvToBusinesses(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].subcategory).toBe("Clubs & Small Venues");
    expect(result.duplicatesInFile).toEqual([
      {
        line: 3,
        category: "venue",
        name_key: "the 19th hole putters gutters",
        firstSeenLine: 2,
      },
    ]);
  });

  it("keeps the same name in different categories as separate rows", () => {
    // SoundCheck Austin is genuinely all three of these. Deduping on name
    // alone would destroy two real listings.
    const csv = [
      HEADER,
      "Backline Companies,SoundCheck Austin,a@b.com,http://soundcheckaustin.com/,",
      "Instrument Rental,SoundCheck Austin,a@b.com,http://soundcheckaustin.com/,",
      "Rehearsal Studios,SoundCheck Austin,a@b.com,http://soundcheckaustin.com/,",
    ].join("\n");

    const result = mapCsvToBusinesses(csv);

    expect(result.rows).toHaveLength(3);
    expect(result.duplicatesInFile).toHaveLength(0);
    expect(result.rows.map((r) => r.category)).toEqual([
      "backline",
      "instrument_rental",
      "rehearsal_studio",
    ]);
  });

  it("collects unmappable rows instead of throwing", () => {
    const csv = [HEADER, "Nightclubs,X,,,", "Venues,Mohawk,,,"].join("\n");
    const result = mapCsvToBusinesses(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });

  it("reports a bad header as a parse error rather than zero rows", () => {
    const result = mapCsvToBusinesses("Wrong,Header\na,b");
    expect(result.parseError).toBeTruthy();
    expect(result.rows).toHaveLength(0);
  });
});
