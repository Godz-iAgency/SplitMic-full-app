"use client";

import { TextField } from "@/components/onboarding/fields/TextField";
import { NumberField } from "@/components/onboarding/fields/NumberField";
import { SelectField } from "@/components/onboarding/fields/SelectField";
import { GenreMultiSelect } from "@/components/onboarding/fields/GenreMultiSelect";

export type TalentBuyerFormValues = {
  company_name: string;
  company_type: "" | "booking_agent" | "promoter" | "event_planner" | "other";
  genres_focus: string[];
  typical_booking_fee: string;
  booking_radius_miles: number | "";
  // New fields
  contact_email: string;
  artist_budget_min: number | "";
  artist_budget_max: number | "";
  events_per_year: number | "";
};

type Props = {
  values: TalentBuyerFormValues;
  onChange: <K extends keyof TalentBuyerFormValues>(
    key: K,
    value: TalentBuyerFormValues[K],
  ) => void;
};

export function TalentBuyerForm({ values, onChange }: Props) {
  return (
    <div className="space-y-4">
      <TextField
        id="company_name"
        label="Company Name"
        value={values.company_name}
        onChange={(v) => onChange("company_name", v)}
        required
      />
      <SelectField
        id="company_type"
        label="Company Type"
        value={values.company_type}
        onChange={(v) => onChange("company_type", v as TalentBuyerFormValues["company_type"])}
        required
        options={[
          { value: "booking_agent", label: "Booking Agent" },
          { value: "promoter", label: "Promoter" },
          { value: "event_planner", label: "Event Planner" },
          { value: "other", label: "Other" },
        ]}
      />
      <TextField
        id="contact_email"
        label="Contact Email"
        type="email"
        value={values.contact_email}
        onChange={(v) => onChange("contact_email", v)}
        required
        autoComplete="email"
        placeholder="hello@yourcompany.com"
      />
      <GenreMultiSelect
        id="genres_focus"
        label="Genres Focus"
        value={values.genres_focus}
        onChange={(v) => onChange("genres_focus", v)}
        required
      />
      <TextField
        id="typical_booking_fee"
        label="Your Service Fee"
        value={values.typical_booking_fee}
        onChange={(v) => onChange("typical_booking_fee", v)}
        required
        placeholder="$500–$2,500"
        hint="Free-form: what you charge clients (range, flat, or %)."
      />
      <NumberField
        id="booking_radius_miles"
        label="Booking Radius (miles)"
        value={values.booking_radius_miles}
        onChange={(v) => onChange("booking_radius_miles", v)}
        required
        min={1}
        max={10000}
      />
      <NumberField
        id="events_per_year"
        label="Events Per Year"
        value={values.events_per_year}
        onChange={(v) => onChange("events_per_year", v)}
        min={0}
        placeholder="e.g., 25"
        hint="Optional: shows bands how active you are"
      />

      <div className="pt-2">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
          Artist Budget Range
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="artist_budget_min"
              label="Min ($)"
              value={values.artist_budget_min}
              onChange={(v) => onChange("artist_budget_min", v)}
              min={0}
              placeholder="500"
              hint="Optional"
            />
            <NumberField
              id="artist_budget_max"
              label="Max ($)"
              value={values.artist_budget_max}
              onChange={(v) => onChange("artist_budget_max", v)}
              min={0}
              placeholder="5000"
              hint="Optional"
            />
          </div>
          <p className="text-xs text-brand-gray-400">
            What you typically pay artists per booking. Helps bands gauge fit.
            Actual fee is always negotiated per event.
          </p>
        </div>
      </div>
    </div>
  );
}
