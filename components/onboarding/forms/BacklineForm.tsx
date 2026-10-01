"use client";

import { TextField } from "@/components/onboarding/fields/TextField";
import { SelectField } from "@/components/onboarding/fields/SelectField";
import { MultiSelectChips } from "@/components/onboarding/fields/MultiSelectChips";
import { BACKLINE_EQUIPMENT } from "@/lib/profile/vendorOptions";
import type { FormMode } from "./mode";

export type BacklineFormValues = {
  business_name: string;
  equipment: string[];
  delivers: "" | "yes" | "no";
  service_area: string;
  price_note: string;
};

type Props = {
  values: BacklineFormValues;
  onChange: <K extends keyof BacklineFormValues>(
    key: K,
    value: BacklineFormValues[K],
  ) => void;
  mode?: FormMode;
};

export function BacklineForm({ values, onChange, mode = "full" }: Props) {
  const full = mode === "full";

  return (
    <div className="space-y-4">
      <TextField
        id="business_name"
        label="Business Name"
        value={values.business_name}
        onChange={(v) => onChange("business_name", v)}
        maxLength={120}
        required
      />
      {/* Required, but checked in lib/profile/validation.ts: a chip picker
          isn't a native form control, so `required` here only draws the
          asterisk. */}
      <MultiSelectChips
        id="equipment"
        label="What You Provide"
        value={values.equipment}
        onChange={(v) => onChange("equipment", v)}
        options={BACKLINE_EQUIPMENT}
        required
      />
      <SelectField
        id="delivers"
        label="Do You Deliver to the Venue?"
        value={values.delivers}
        onChange={(v) => onChange("delivers", v as BacklineFormValues["delivers"])}
        required
        options={[
          { value: "yes", label: "Yes, we deliver and set up" },
          { value: "no", label: "No, pickup only" },
        ]}
      />

      {full ? (
        <TextField
          id="service_area"
          label="Service Area"
          value={values.service_area}
          onChange={(v) => onChange("service_area", v)}
          maxLength={120}
          placeholder="Austin and 50 miles out"
          hint="Optional"
        />
      ) : null}

      {/* A note rather than a number: a backline quote depends on the gear,
          the date, and the drive, so a single figure would promise a price
          nobody quoted. */}
      {full ? (
        <TextField
          id="price_note"
          label="Pricing"
          value={values.price_note}
          onChange={(v) => onChange("price_note", v)}
          maxLength={200}
          placeholder="Full backline from $250 a night"
          hint="Optional: a starting point, not a quote"
        />
      ) : null}
    </div>
  );
}
