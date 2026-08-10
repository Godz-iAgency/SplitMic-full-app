import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { mapCsvToBusinesses } from "./mapRow";
import { DIRECTORY_CATEGORIES, type DirectoryCategory } from "./categories";

/**
 * Runs the real scraped CSV through the mapper and asserts the exact numbers
 * the import is expected to produce. This is the check that catches a parser
 * regression against actual data rather than hand-written fixtures.
 *
 * The CSV is gitignored (it holds scraped third-party contact emails), so
 * these skip rather than fail when it isn't present.
 */

const CSV_PATH = join(process.cwd(), "business_directory_scraped.csv");
const hasCsv = existsSync(CSV_PATH);
const describeWithCsv = hasCsv ? describe : describe.skip;

describeWithCsv("business_directory_scraped.csv", () => {
  const text = hasCsv ? readFileSync(CSV_PATH, "utf8") : "";
  const result = mapCsvToBusinesses(text);

  it("parses without a header or format error", () => {
    expect(result.parseError).toBeUndefined();
  });

  it("maps every row — nothing unmappable", () => {
    expect(result.skipped).toEqual([]);
  });

  it("finds the two known in-file duplicates", () => {
    expect(result.duplicatesInFile.map((d) => d.name_key).sort()).toEqual([
      "texas music ranch",
      "the 19th hole putters gutters",
    ]);
  });

  it("yields 584 importable rows", () => {
    expect(result.rows).toHaveLength(584);
  });

  it("splits into the expected per-category counts", () => {
    const counts = Object.fromEntries(
      DIRECTORY_CATEGORIES.map((c) => [
        c,
        result.rows.filter((r) => r.category === c).length,
      ]),
    ) as Record<DirectoryCategory, number>;

    expect(counts).toEqual({
      venue: 296,
      record_label: 77,
      talent_buyer: 76,
      band: 44,
      festival: 40,
      instrument_rental: 25,
      rehearsal_studio: 21,
      backline: 5,
    });
  });

  it("extracts exactly the 11 phone numbers present, with no false positives", () => {
    expect(result.rows.filter((r) => r.phone !== null)).toHaveLength(11);
  });

  it("gives every venue a subcategory and every band a genre", () => {
    const venues = result.rows.filter((r) => r.category === "venue");
    const bands = result.rows.filter((r) => r.category === "band");
    expect(venues.every((v) => v.subcategory !== null)).toBe(true);
    expect(bands.every((b) => b.subcategory !== null)).toBe(true);
  });

  it("keeps the unquoted-comma row intact", () => {
    const row = result.rows.find(
      (r) => r.business_name === "Outside the City Limits Festival",
    );
    expect(row).toBeDefined();
    expect(row?.subcategory).toBe("Fall");
    expect(row?.description).toBe("Vista Brewing, Driftwood TX");
  });

  it("preserves subdomain websites instead of prefixing www.", () => {
    const withWww = result.rows.filter((r) =>
      /^https?:\/\/www\.[^/]*\.(bandcamp|eventim)\./.test(r.website_url ?? ""),
    );
    expect(withWww).toEqual([]);
  });

  it("never produces a row that would violate the unique constraint", () => {
    const keys = result.rows.map((r) => `${r.category}||${r.name_key}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
