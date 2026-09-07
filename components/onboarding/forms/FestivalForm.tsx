"use client";

import { TextField } from "@/components/onboarding/fields/TextField";
import { NumberField } from "@/components/onboarding/fields/NumberField";
import { SelectField } from "@/components/onboarding/fields/SelectField";
import { GenreMultiSelect } from "@/components/onboarding/fields/GenreMultiSelect";
import type { FormMode } from "./mode";

export type FestivalFormValues = {
  festival_name: string;
  festival_type: "" | "single_day" | "multi_day" | "multi_stage" | "outdoor" | "indoor" | "other";
  festival_season: "" | "spring" | "summer" | "fall" | "winter" | "year_round";
  genres_featured: string[];
  expected_attendance: number | "";
  total_band_slots: number | "";
  application_email: string;
  pays_bands: "" | "yes" | "no";
  pay_min: number | "";
  pay_max: number | "";
};

type Props = {
  values: FestivalFormValues;
  onChange: <K extends keyof FestivalFormValues>(
    key: K,
    value: FestivalFormValues[K],
  ) => void;
  mode?: FormMode;
};

export function FestivalForm({ values, onChange, mode = "full" }: Props) {
  const full = mode === "full";
  const showPayRange = values.pays_bands === "yes";

  return (
    <div className="space-y-4">
      <TextField
        id="festival_name"
        label="Festival Name"
        value={values.festival_name}
        onChange={(v) => onChange("festival_name", v)}
        required
      />
      <SelectField
        id="festival_type"
        label="Festival Type"
        value={values.festival_type}
        onChange={(v) =>
          onChange("festival_type", v as FestivalFormValues["festival_type"])
        }
        required
        options={[
          { value: "single_day", label: "Single Day" },
          { value: "multi_day", label: "Multi-Day" },
          { value: "multi_stage", label: "Multi-Stage" },
          { value: "outdoor", label: "Outdoor" },
          { value: "indoor", label: "Indoor" },
          { value: "other", label: "Other" },
        ]}
      />
      <GenreMultiSelect
        id="genres_featured"
        label="Genres Featured"
        value={values.genres_featured}
        onChange={(v) => onChange("genres_featured", v)}
        required
      />

      {full ? (
        <SelectField
          id="festival_season"
          label="When does it happen?"
          value={values.festival_season}
          onChange={(v) =>
            onChange("festival_season", v as FestivalFormValues["festival_season"])
          }
          options={[
            { value: "spring", label: "Spring (Mar–May)" },
            { value: "summer", label: "Summer (Jun–Aug)" },
            { value: "fall", label: "Fall (Sep–Nov)" },
            { value: "winter", label: "Winter (Dec–Feb)" },
            { value: "year_round", label: "Year-Round / Recurring" },
          ]}
          hint="Optional"
        />
      ) : null}

      {full ? (
        <NumberField
          id="expected_attendance"
          label="Expected Attendance"
          value={values.expected_attendance}
          onChange={(v) => onChange("expected_attendance", v)}
          min={1}
          hint="Optional"
        />
      ) : null}

      {full ? (
        <NumberField
          id="total_band_slots"
          label="Total Band Slots"
          value={values.total_band_slots}
          onChange={(v) => onChange("total_band_slots", v)}
          min={1}
          hint="Optional"
        />
      ) : null}

      {full ? (
        <TextField
          id="application_email"
          label="Application / Submission Email"
          type="email"
          value={values.application_email}
          onChange={(v) => onChange("application_email", v)}
          autoComplete="email"
          placeholder="apply@yourfestival.com"
          hint="Optional: where bands send applications to play"
        />
      ) : null}

      {full ? (
        <div className="pt-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
            Band Payment
          </h3>
          <div className="space-y-4">
            <SelectField
              id="pays_bands"
              label="Do you pay bands?"
              value={values.pays_bands}
              onChange={(v) =>
                onChange("pays_bands", v as FestivalFormValues["pays_bands"])
              }
              options={[
                { value: "yes", label: "Yes, we pay" },
                { value: "no", label: "No, exposure only" },
              ]}
              hint="Optional"
            />
            {showPayRange ? (
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  id="pay_min"
                  label="Min Pay ($)"
                  value={values.pay_min}
                  onChange={(v) => onChange("pay_min", v)}
                  min={0}
                  placeholder="200"
                  hint="Per band, optional"
                />
                <NumberField
                  id="pay_max"
                  label="Max Pay ($)"
                  value={values.pay_max}
                  onChange={(v) => onChange("pay_max", v)}
                  min={0}
                  placeholder="2000"
                  hint="Per band, optional"
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
