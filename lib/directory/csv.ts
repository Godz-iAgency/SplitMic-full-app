/**
 * A small RFC4180-ish CSV parser.
 *
 * Hand-rolled rather than pulling in a dependency, matching how lib/ai/gemini.ts
 * and lib/events/do512.ts hit external formats with plain built-ins. The input
 * is one known file shape, not arbitrary user CSV.
 *
 * A naive line.split(",") would corrupt this data: the Notes column contains
 * commas both inside quotes (most band rows) and, on one row, outside them.
 */

/** The expected header row of business_directory_scraped.csv. */
export const DIRECTORY_CSV_HEADERS = [
  "Category",
  "Business Name",
  "Email",
  "Website",
  "Notes",
] as const;

const EXPECTED_COLUMNS = DIRECTORY_CSV_HEADERS.length;

export type CsvRow = {
  /**
   * 1-based row number counting the header as row 1, for error reporting.
   * Equals the file's line number unless a quoted field spans lines.
   */
  line: number;
  cols: string[];
};

export type ReadCsvResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; reason: string };

/**
 * Splits CSV text into rows of raw cells. Handles quoted fields, embedded
 * commas and newlines, and "" as an escaped quote.
 */
export function parseCsv(text: string): string[][] {
  // Strip a UTF-8 BOM — Excel adds one and it would corrupt the first header.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'; // escaped quote
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Treat \r\n as one break, not two.
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Final field/row, unless the file ended on a clean newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop trailing all-empty rows (a trailing newline produces one).
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.every((cell) => cell.trim() === "")) rows.pop();
    else break;
  }

  return rows;
}

/**
 * Normalizes a parsed row to exactly 5 columns.
 *
 * Wide rows are real in this data: one Festivals row has an unquoted comma in
 * its Notes ("Fall; Vista Brewing, Driftwood TX"), splitting into 6 cells.
 * Rejoining the overflow keeps the row instead of dropping a real business.
 */
function normalizeWidth(cols: string[]): string[] {
  if (cols.length === EXPECTED_COLUMNS) return cols;
  if (cols.length > EXPECTED_COLUMNS) {
    return [
      ...cols.slice(0, EXPECTED_COLUMNS - 1),
      cols.slice(EXPECTED_COLUMNS - 1).join(","),
    ];
  }
  return [...cols, ...Array(EXPECTED_COLUMNS - cols.length).fill("")];
}

/** Parses the directory CSV, validating its header and normalizing row width. */
export function readCsvRows(text: string): ReadCsvResult {
  const parsed = parseCsv(text);
  if (parsed.length === 0) return { ok: false, reason: "The CSV is empty." };

  const header = parsed[0].map((h) => h.trim());
  const expected = DIRECTORY_CSV_HEADERS;
  const headerMatches =
    header.length >= expected.length &&
    expected.every((name, i) => header[i]?.toLowerCase() === name.toLowerCase());

  if (!headerMatches) {
    return {
      ok: false,
      reason: `Unexpected header row. Expected "${expected.join(",")}" but got "${header.join(",")}".`,
    };
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < parsed.length; i += 1) {
    const cols = normalizeWidth(parsed[i]);
    if (cols.every((cell) => cell.trim() === "")) continue; // blank row
    rows.push({ line: i + 1, cols });
  }

  return { ok: true, rows };
}
