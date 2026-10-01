"use client";

import { TextField } from "@/components/onboarding/fields/TextField";
import { SelectField } from "@/components/onboarding/fields/SelectField";
import { MultiSelectChips } from "@/components/onboarding/fields/MultiSelectChips";
import {
  RENTAL_INSTRUMENTS,
  RENTAL_PERIODS,
} from "@/lib/profile/vendorOptions";
import type { FormMode } from "./mode";

export type InstrumentRentalFormValues = {
  business_name: string;
  instruments: string[];
  rental_periods: string[];
  delivers: "" | "yes" | "no";
  price_note: string;
};

type Props = {
  values: InstrumentRentalFormValues;
  onChange: <K extends keyof InstrumentRentalFormValues>(
    key: K,
    value: InstrumentRentalFormValues[K],
  ) => void;
  mode?: FormMode;
};

export function InstrumentRentalForm({ values, onChange, mode = "full" }: Props) {
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
        id="instruments"
        label="What You Rent"
        value={values.instruments}
        onChange={(v) => onChange("instruments", v)}
        options={RENTAL_INSTRUMENTS}
        required
      />
      <MultiSelectChips
        id="rental_periods"
        label="Rental Periods"
        value={values.rental_periods}
        onChange={(v) => onChange("rental_periods", v)}
        options={RENTAL_PERIODS}
        hint="Optional"
      />

      {full ? (
        <SelectField
          id="delivers"
          label="Delivery or Pickup"
          value={values.delivers}
          onChange={(v) =>
            onChange("delivers", v as InstrumentRentalFormValues["delivers"])
          }
          options={[
            { value: "yes", label: "We deliver" },
            { value: "no", label: "Pickup only" },
          ]}
          hint="Optional"
        />
      ) : null}

      {full ? (
        <TextField
          id="price_note"
          label="Pricing"
          value={values.price_note}
          onChange={(v) => onChange("price_note", v)}
          maxLength={200}
          placeholder="Guitars from $25 a day"
          hint="Optional: a starting point, not a quote"
        />
      ) : null}
    </div>
  );
}
