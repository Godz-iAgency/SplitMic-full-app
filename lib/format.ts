// Display formatting helpers for form fields.
// These are idempotent — running them on an already-formatted value
// strips it back to digits and re-formats, producing the same result.

/**
 * Formats a US phone number for display, e.g. "5703372439" -> "(570) 337-2439".
 * A leading "1" country code is kept as a prefix: "15703372439" -> "1 (570) 337-2439".
 * Partial input formats as far as it can, so it works as the user types.
 */
export function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";

  let countryCode = "";
  let rest = digits;
  if (digits.length > 10 && digits.startsWith("1")) {
    countryCode = "1 ";
    rest = digits.slice(1);
  }
  rest = rest.slice(0, 10);

  const area = rest.slice(0, 3);
  const prefix = rest.slice(3, 6);
  const line = rest.slice(6, 10);

  let out = "";
  if (area) out = `(${area}`;
  if (area.length === 3) out += ") ";
  if (prefix) out += prefix;
  if (prefix.length === 3) out += "-";
  if (line) out += line;

  return countryCode + out;
}

/** Formats a number with thousands separators, e.g. 52221122 -> "52,221,122". */
export function formatThousands(value: number | ""): string {
  if (value === "") return "";
  return value.toLocaleString("en-US");
}

/** Parses a grouped string back to a number, e.g. "52,221,122" -> 52221122. */
export function parseDigitsToNumber(input: string): number | "" {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  const num = Number(digits);
  return Number.isNaN(num) ? "" : num;
}
