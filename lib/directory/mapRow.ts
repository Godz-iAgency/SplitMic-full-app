/**
 * Turns a raw scraped CSV row into a directory_businesses row.
 *
 * All pure — no database, no network — so the messy parts (phone extraction,
 * URL handling, the per-category meaning of the Notes column) are directly
 * testable against real fixtures from the file.
 */

import { formatPhone } from "@/lib/format";
import {
  categoryFromCsvLabel,
  type DirectoryCategory,
} from "./categories";
import { readCsvRows } from "./csv";

export type DirectoryBusinessInsert = {
  category: DirectoryCategory;
  business_name: string;
  name_key: string;
  email: string | null;
  website_url: string | null;
  phone: string | null;
  description: string | null;
  subcategory: string | null;
  source_row: Record<string, string>;
};

export type MapRowFailure = { line: number; reason: string };

export type MapCsvResult = {
  rows: DirectoryBusinessInsert[];
  skipped: MapRowFailure[];
  /** Rows dropped because an earlier row already claimed the same key. */
  duplicatesInFile: {
    line: number;
    category: DirectoryCategory;
    name_key: string;
    firstSeenLine: number;
  }[];
};

// ── Field normalizers ───────────────────────────────────────────────────────

/**
 * The dedupe key: lowercase, collapse every run of non-alphanumerics to a
 * single space, trim.
 *
 *   "The 19th Hole @ Putters & Gutters" -> "the 19th hole putters gutters"
 *
 * Deliberately does NOT strip a leading "the" the way normalizeNameForMatch()
 * in lib/events/matching.ts does. That one is a fuzzy matcher; this is an
 * identity key, and merging "The Mohawk" into "Mohawk" would fuse distinct
 * businesses into one row.
 */
export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Pulls a US phone number out of free-text Notes, or null.
 *
 * Only 11 of 586 rows have one, so avoiding false positives matters far more
 * than catching every exotic format. Requiring BOTH internal separators means
 * street numbers ("18105 Foust Drive"), ZIPs ("78610"), suite numbers, and
 * prices can't masquerade as phone numbers.
 */
export function extractPhone(notes: string): string | null {
  const match = PHONE_PATTERN.exec(notes);
  if (!match) return null;

  let digits = `${match[1]}${match[2]}${match[3]}`.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;

  return formatPhone(digits);
}

/**
 * Both separators are required (no bare 5127505846), and digit boundaries on
 * each end stop a match inside a longer number.
 */
const PHONE_PATTERN =
  /(?:^|[^\d])(?:\+?1[\s.-]?)?(\(?\d{3}\)?)[\s.-](\d{3})[\s.-](\d{4})(?!\d)/;

/**
 * Normalizes a scraped website to an absolute URL, preserving its host exactly.
 *
 * Do NOT swap this for normalizeWebsiteUrl() in lib/url.ts. That one force-adds
 * a "www." prefix, which is right for user-typed bare domains but would break
 * the 47+ subdomain URLs in this data — "amplifiedheat.bandcamp.com" would
 * become "www.amplifiedheat.bandcamp.com", which does not resolve.
 */
export function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    // Guard against javascript:, data:, etc. sneaking through a scrape.
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return null;
  return trimmed;
}

// ── Notes splitting ─────────────────────────────────────────────────────────

/** The 4 venue-type labels the scrape produced, mapped to display copy. */
const VENUE_SUBCATEGORIES: Record<string, string> = {
  "clubs/dancehalls/small venues": "Clubs & Small Venues",
  "concert halls/performing arts centers": "Concert Halls & Performing Arts",
  "stadiums/amphitheaters/fairgrounds": "Stadiums & Amphitheaters",
  "auditoriums/arenas": "Auditoriums & Arenas",
};

const FESTIVAL_SEASONS = new Set([
  "spring",
  "summer",
  "fall",
  "winter",
  "spring/fall",
]);

/** Removes the phone (and its "Phone" label) from Notes, leaving prose. */
function stripPhone(notes: string): string {
  return notes
    .replace(
      /(?:phone[:\s]*)?(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}[.;,]?/i,
      "",
    )
    .replace(/\s+/g, " ")
    .replace(/^[\s.;,-]+|[\s.;,-]+$/g, "")
    .trim();
}

/**
 * The Notes column means something different per category, so it splits into
 * a description plus an optional subcategory rather than one blob:
 *
 *   venue    -> a venue-type taxonomy label ("Clubs/Dancehalls/Small Venues")
 *   band     -> "Genre: X; Active: Y; Contact: Z"
 *   festival -> "Season; venue; note"
 *   others   -> free text, mostly empty
 */
export function splitNotes(
  category: DirectoryCategory,
  notes: string,
): { description: string | null; subcategory: string | null } {
  const rest = stripPhone(notes);
  if (!rest) return { description: null, subcategory: null };

  if (category === "venue") {
    const mapped = VENUE_SUBCATEGORIES[rest.toLowerCase()];
    if (mapped) return { description: null, subcategory: mapped };
  }

  if (category === "band") {
    const genreMatch = /^genre:\s*([^;]+)(?:;\s*(.*))?$/i.exec(rest);
    if (genreMatch) {
      return {
        subcategory: genreMatch[1].trim() || null,
        description: genreMatch[2]?.trim() || null,
      };
    }
  }

  if (category === "festival") {
    const [first, ...remainder] = rest.split(";");
    if (FESTIVAL_SEASONS.has(first.trim().toLowerCase())) {
      return {
        subcategory: first.trim(),
        description: remainder.join(";").trim() || null,
      };
    }
  }

  return { description: rest, subcategory: null };
}

// ── Row mapping ─────────────────────────────────────────────────────────────

export function mapCsvRowToBusiness(
  cols: string[],
  line: number,
): { ok: true; value: DirectoryBusinessInsert } | { ok: false; line: number; reason: string } {
  const [rawCategory, rawName, rawEmail, rawWebsite, rawNotes] = cols;

  const category = categoryFromCsvLabel(rawCategory ?? "");
  if (!category) {
    return { ok: false, line, reason: `Unknown category "${rawCategory}"` };
  }

  const business_name = (rawName ?? "").trim();
  if (!business_name) {
    return { ok: false, line, reason: "Missing business name" };
  }

  const name_key = normalizeBusinessName(business_name);
  if (!name_key) {
    return {
      ok: false,
      line,
      reason: `Business name "${business_name}" normalizes to nothing`,
    };
  }

  const notes = rawNotes ?? "";
  const { description, subcategory } = splitNotes(category, notes);

  return {
    ok: true,
    value: {
      category,
      business_name,
      name_key,
      email: normalizeEmail(rawEmail ?? ""),
      website_url: normalizeWebsite(rawWebsite ?? ""),
      phone: extractPhone(notes),
      description,
      subcategory,
      source_row: {
        Category: rawCategory ?? "",
        "Business Name": rawName ?? "",
        Email: rawEmail ?? "",
        Website: rawWebsite ?? "",
        Notes: notes,
      },
    },
  };
}

/**
 * Maps a whole CSV. First occurrence of a (category, name_key) pair wins;
 * later ones are reported rather than merged, so the result is deterministic
 * and the duplicates are visible in the import report instead of silent.
 */
export function mapCsvToBusinesses(text: string): MapCsvResult & { parseError?: string } {
  const parsed = readCsvRows(text);
  if (!parsed.ok) {
    return { rows: [], skipped: [], duplicatesInFile: [], parseError: parsed.reason };
  }

  const rows: DirectoryBusinessInsert[] = [];
  const skipped: MapRowFailure[] = [];
  const duplicatesInFile: MapCsvResult["duplicatesInFile"] = [];
  const seen = new Map<string, number>();

  for (const { line, cols } of parsed.rows) {
    const mapped = mapCsvRowToBusiness(cols, line);
    if (!mapped.ok) {
      skipped.push({ line: mapped.line, reason: mapped.reason });
      continue;
    }

    const key = `${mapped.value.category}||${mapped.value.name_key}`;
    const firstSeenLine = seen.get(key);
    if (firstSeenLine !== undefined) {
      duplicatesInFile.push({
        line,
        category: mapped.value.category,
        name_key: mapped.value.name_key,
        firstSeenLine,
      });
      continue;
    }

    seen.set(key, line);
    rows.push(mapped.value);
  }

  return { rows, skipped, duplicatesInFile };
}
