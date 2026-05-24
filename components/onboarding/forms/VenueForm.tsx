"use client";

import { TextField } from "@/components/onboarding/fields/TextField";
import { NumberField } from "@/components/onboarding/fields/NumberField";
import { SelectField } from "@/components/onboarding/fields/SelectField";
import { GenreMultiSelect } from "@/components/onboarding/fields/GenreMultiSelect";

export type VenueFormValues = {
  venue_name: string;
  venue_type: "" | "bar" | "concert_hall" | "restaurant" | "outdoor" | "club" | "other";
  capacity: number | "";
  age_restriction: "" | "all_ages" | "18_plus" | "21_plus";
  genres_hosted: string[];
  shows_per_week: number | "";
  booking_contact_name: string;
  booking_contact_email: string;
  // What we pay bands
  pay_structure: "" | "guarantee" | "door_split" | "combo" | "varies";
  pay_min: number | "";
  pay_max: number | "";
};

type Props = {
  values: VenueFormValues;
  onChange: <K extends keyof VenueFormValues>(
    key: K,
    value: VenueFormValues[K],
  ) => void;
};

export function VenueForm({ values, onChange }: Props) {
  return (
    <div className="space-y-4">
      <TextField
        id="venue_name"
        label="Venue Name"
        value={values.venue_name}
        onChange={(v) => onChange("venue_name", v)}
        required
      />
      <SelectField
        id="venue_type"
        label="Venue Type"
        value={values.venue_type}
        onChange={(v) => onChange("venue_type", v as VenueFormValues["venue_type"])}
        required
        options={[
          { value: "bar", label: "Bar" },
          { value: "concert_hall", label: "Concert Hall" },
          { value: "club", label: "Club" },
          { value: "restaurant", label: "Restaurant" },
          { value: "outdoor", label: "Outdoor Stage" },
          { value: "other", label: "Other" },
        ]}
      />
      <NumberField
        id="capacity"
        label="Capacity"
        value={values.capacity}
        onChange={(v) => onChange("capacity", v)}
        required
        min={1}
      />
      <SelectField
        id="age_restriction"
        label="Age Restriction"
        value={values.age_restriction}
        onChange={(v) =>
          onChange("age_restriction", v as VenueFormValues["age_restriction"])
        }
        required
        options={[
          { value: "all_ages", label: "All Ages" },
          { value: "18_plus", label: "18+" },
          { value: "21_plus", label: "21+" },
        ]}
      />
      <GenreMultiSelect
        id="genres_hosted"
        label="Genres Hosted"
        value={values.genres_hosted}
        onChange={(v) => onChange("genres_hosted", v)}
        required
      />
      <NumberField
        id="shows_per_week"
        label="Shows Per Week"
        value={values.shows_per_week}
        onChange={(v) => onChange("shows_per_week", v)}
        required
        min={0}
        max={21}
      />
      <TextField
        id="booking_contact_name"
        label="Booking Contact Name"
        value={values.booking_contact_name}
        onChange={(v) => onChange("booking_contact_name", v)}
        required
      />
      <TextField
        id="booking_contact_email"
        label="Booking Contact Email"
        type="email"
        value={values.booking_contact_email}
        onChange={(v) => onChange("booking_contact_email", v)}
        required
        autoComplete="email"
        placeholder="bookings@yourvenue.com"
      />

      <div className="pt-2">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
          What you pay bands
        </h3>
        <div className="space-y-4">
          <SelectField
            id="pay_structure"
            label="Deal Type"
            value={values.pay_structure}
            onChange={(v) =>
              onChange("pay_structure", v as VenueFormValues["pay_structure"])
            }
            options={[
              { value: "guarantee", label: "Flat Guarantee" },
              { value: "door_split", label: "Door Split (% of ticket sales)" },
              { value: "combo", label: "Guarantee + Door Split" },
              { value: "varies", label: "Varies per show" },
            ]}
            hint="Optional — helps bands decide if you're a fit"
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="pay_min"
              label="Pay — Min ($)"
              value={values.pay_min}
              onChange={(v) => onChange("pay_min", v)}
              min={0}
              placeholder="200"
              hint="Optional"
            />
            <NumberField
              id="pay_max"
              label="Pay — Max ($)"
              value={values.pay_max}
              onChange={(v) => onChange("pay_max", v)}
              min={0}
              placeholder="1500"
              hint="Optional"
            />
          </div>
          <p className="text-xs text-brand-gray-400">
            Typical range only. You'll set actual pay per gig when posting
            specific opportunities.
          </p>
        </div>
      </div>
    </div>
  );
}
