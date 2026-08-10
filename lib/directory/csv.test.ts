import { describe, it, expect } from "vitest";
import { parseCsv, readCsvRows, DIRECTORY_CSV_HEADERS } from "./csv";

const HEADER = DIRECTORY_CSV_HEADERS.join(",");

describe("parseCsv", () => {
  it("splits a plain row", () => {
    expect(parseCsv("a,b,c")).toEqual([["a", "b", "c"]]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it('unescapes "" inside a quoted field', () => {
    // Real fixture: the Amplified Heat band row quotes a single title.
    expect(parseCsv('a,"Spotify shows 2026 single ""Schizofrantic Ace""",b')).toEqual([
      ["a", 'Spotify shows 2026 single "Schizofrantic Ace"', "b"],
    ]);
  });

  it("handles a newline inside a quoted field", () => {
    expect(parseCsv('a,"line one\nline two",b')).toEqual([
      ["a", "line one\nline two", "b"],
    ]);
  });

  it("treats CRLF as a single row break", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("strips a UTF-8 BOM from the first field", () => {
    expect(parseCsv("﻿Category,Name")).toEqual([["Category", "Name"]]);
  });

  it("drops a trailing blank row from a final newline", () => {
    expect(parseCsv("a,b\n")).toEqual([["a", "b"]]);
  });

  it("preserves empty fields", () => {
    expect(parseCsv("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("returns nothing for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("readCsvRows", () => {
  it("returns data rows with row numbers, excluding the header", () => {
    const result = readCsvRows(`${HEADER}\nVenues,Mohawk,a@b.com,https://x.com,Notes here`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([
      {
        line: 2,
        cols: ["Venues", "Mohawk", "a@b.com", "https://x.com", "Notes here"],
      },
    ]);
  });

  it("rejoins a 6-column row into Notes rather than dropping it", () => {
    // Real fixture, line 79 of business_directory_scraped.csv: the Notes field
    // is unquoted and contains a comma.
    const result = readCsvRows(
      `${HEADER}\nFestivals,Outside the City Limits Festival,,https://www.vistabrewingtx.com/ocl-music-festival,Fall; Vista Brewing, Driftwood TX`,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].cols[4]).toBe("Fall; Vista Brewing, Driftwood TX");
  });

  it("right-pads a short row", () => {
    const result = readCsvRows(`${HEADER}\nVenues,Mohawk`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].cols).toEqual(["Venues", "Mohawk", "", "", ""]);
  });

  it("skips blank rows in the middle of the file", () => {
    const result = readCsvRows(`${HEADER}\nVenues,A,,,\n,,,,\nVenues,B,,,`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((r) => r.cols[1])).toEqual(["A", "B"]);
  });

  it("rejects a file with the wrong header", () => {
    const result = readCsvRows("Name,Phone\nA,123");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(readCsvRows("").ok).toBe(false);
  });

  it("accepts a header regardless of case", () => {
    expect(readCsvRows("category,business name,email,website,notes\nVenues,A,,,").ok).toBe(
      true,
    );
  });
});
