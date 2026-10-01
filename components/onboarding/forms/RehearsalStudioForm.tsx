"use client";

import { TextField } from "@/components/onboarding/fields/TextField";
import { NumberField } from "@/components/onboarding/fields/NumberField";
import { MultiSelectChips } from "@/components/onboarding/fields/MultiSelectChips";
import { STUDIO_GEAR } from "@/lib/profile/vendorOptions";
import type { FormMode } from "./mode";

export type RehearsalStudioFormValues = {
  business_name: string;
  room_count: number | "";
  gear_included: string[];
  rate_note: string;
  max_people_per_room: number | "";
  hours_note: string;
};

type Props = {
  values: RehearsalStudioFormValues;
  onChange: <K extends keyof RehearsalStudioFormValues>(
    key: K,
    value: RehearsalStudioFormValues[K],
  ) => void;
  mode?: FormMode;
};

export function RehearsalStudioForm({ values, onChange, mode = "full" }: Props) {
  const full = mode === "full";

  return (
    <div className="space-y-4">
      <TextField
        id="business_name"
        label="Studio Name"
        value={values.business_name}
        onChange={(v) => onChange("business_name", v)}
        maxLength={120}
        required
      />
      <NumberField
        id="room_count"
        label="Number of Rooms"
        value={values.room_count}
        onChange={(v) => onChange("room_count", v)}
        min={1}
        max={100}
        required
      />
      {/* Optional: plenty of rooms are bring-your-own-gear, and an empty list
          is a true answer for them. */}
      <MultiSelectChips
        id="gear_included"
        label="Gear in the Room"
        value={values.gear_included}
        onChange={(v) => onChange("gear_included", v)}
        options={STUDIO_GEAR}
        hint="Optional: leave blank if bands bring their own"
      />

      {/* Free text, not a min/max pair: studios price by the hour, the block,
          and the month, and a range field would force one of those. */}
      {full ? (
        <TextField
          id="rate_note"
          label="Hourly Rates"
          value={values.rate_note}
          onChange={(v) => onChange("rate_note", v)}
          maxLength={200}
          placeholder="$20 to $35 an hour, monthly lockouts available"
          hint="Optional: a starting point, not a quote"
        />
      ) : null}

      {full ? (
        <NumberField
          id="max_people_per_room"
          label="Max People per Room"
          value={values.max_people_per_room}
          onChange={(v) => onChange("max_people_per_room", v)}
          min={1}
          max={100}
          hint="Optional"
        />
      ) : null}

      {full ? (
        <TextField
          id="hours_note"
          label="Hours"
          value={values.hours_note}
          onChange={(v) => onChange("hours_note", v)}
          maxLength={200}
          placeholder="Open daily, noon to 2am"
          hint="Optional"
        />
      ) : null}
    </div>
  );
}
