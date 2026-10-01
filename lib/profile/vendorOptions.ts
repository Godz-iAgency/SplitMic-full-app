import type { VendorPlayerType } from "@/lib/types";

/**
 * The chip lists the three vendor forms offer, and how a saved vendor reads
 * back out on Discover and the profile page.
 *
 * Values are stored as these slugs, never as labels, so a label can be reworded
 * without touching saved rows. Anything not in a list is dropped on save
 * (pickKnown) and skipped on display (labelsFor): the arrays come from the
 * browser, so an arbitrary string must never be written or rendered.
 *
 * Pricing is deliberately a free-text note everywhere, not a number. A vendor's
 * rate depends on the gear, the date, and the distance, so a structured price
 * would imply a quote nobody gave.
 */

export type VendorOption = { value: string; label: string };

/** Backline: what a company brings to a show. */
export const BACKLINE_EQUIPMENT: VendorOption[] = [
  { value: "drums", label: "Drums" },
  { value: "amps", label: "Amps" },
  { value: "pa", label: "PA" },
  { value: "keys", label: "Keys" },
  { value: "lighting", label: "Lighting" },
];

/** Instrument rental: what a shop rents out. */
export const RENTAL_INSTRUMENTS: VendorOption[] = [
  { value: "guitars", label: "Guitars & bass" },
  { value: "drums", label: "Drums" },
  { value: "keys", label: "Keys" },
  { value: "strings", label: "Strings" },
  { value: "dj_gear", label: "DJ gear" },
];

export const RENTAL_PERIODS: VendorOption[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/** Rehearsal studio: what is already in the room. */
export const STUDIO_GEAR: VendorOption[] = [
  { value: "drum_kit", label: "Drum kit" },
  { value: "amps", label: "Amps" },
  { value: "pa", label: "PA system" },
  { value: "keys", label: "Keys" },
  { value: "mics", label: "Mics" },
];

/** Keeps only values that exist in the list, in the list's own order, once each. */
export function pickKnown(options: VendorOption[], values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const wanted = new Set(values.filter((v): v is string => typeof v === "string"));
  return options.filter((o) => wanted.has(o.value)).map((o) => o.value);
}

/** Labels for the known values, in the list's own order. */
export function labelsFor(options: VendorOption[], values: unknown): string[] {
  const known = new Set(pickKnown(options, values));
  return options.filter((o) => known.has(o.value)).map((o) => o.label);
}

/**
 * The one-line summary under a vendor's name on a Discover card, e.g.
 * "Drums, Amps, PA · Delivers". Falls back to the type's own name so a card is
 * never blank, the same way the other player types fall back.
 */
export function vendorOneLiner(
  type: VendorPlayerType,
  row: Record<string, unknown>,
): string {
  const parts: string[] = [];
  switch (type) {
    case "backline": {
      const gear = labelsFor(BACKLINE_EQUIPMENT, row.equipment);
      if (gear.length > 0) parts.push(gear.join(", "));
      if (row.delivers === true) parts.push("Delivers");
      return parts.join(" · ") || "Backline company";
    }
    case "instrument_rental": {
      const gear = labelsFor(RENTAL_INSTRUMENTS, row.instruments);
      if (gear.length > 0) parts.push(gear.join(", "));
      if (row.delivers === true) parts.push("Delivers");
      return parts.join(" · ") || "Instrument rental";
    }
    case "rehearsal_studio": {
      const rooms = typeof row.room_count === "number" ? row.room_count : null;
      if (rooms !== null && rooms > 0)
        parts.push(rooms === 1 ? "1 room" : `${rooms} rooms`);
      const gear = labelsFor(STUDIO_GEAR, row.gear_included);
      if (gear.length > 0) parts.push(gear.join(", "));
      return parts.join(" · ") || "Rehearsal studio";
    }
  }
}
