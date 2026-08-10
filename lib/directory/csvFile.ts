import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Reads the scraped CSV off disk for the admin import. Server-only.
 *
 * The file lives at the project root and is gitignored (it holds hundreds of
 * scraped third-party contact addresses), so it exists on the owner's machine
 * but not in a deployment. That's fine — the import is meant to be run from
 * `npm run dev` locally, and the admin screen also takes a pasted CSV for the
 * deployed case.
 */

export const DIRECTORY_CSV_FILENAME = "business_directory_scraped.csv";

export type ReadCsvFileResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export async function readDirectoryCsvFromDisk(): Promise<ReadCsvFileResult> {
  try {
    const text = await readFile(
      join(process.cwd(), DIRECTORY_CSV_FILENAME),
      "utf8",
    );
    return { ok: true, text };
  } catch {
    return {
      ok: false,
      reason: `${DIRECTORY_CSV_FILENAME} was not found at the project root. Run the import from "npm run dev" on the machine that has the file, or paste the CSV contents into the box below.`,
    };
  }
}
