"use client";

import { TextField } from "@/components/onboarding/fields/TextField";
import { TextareaField } from "@/components/onboarding/fields/TextareaField";
import { NumberField } from "@/components/onboarding/fields/NumberField";
import { SelectField } from "@/components/onboarding/fields/SelectField";
import { GenreMultiSelect } from "@/components/onboarding/fields/GenreMultiSelect";
import { MultiSelectChips } from "@/components/onboarding/fields/MultiSelectChips";

export type RecordLabelFormValues = {
  label_name: string;
  label_type: "" | "indie" | "major" | "distributed" | "other";
  genres_focus: string[];
  artists_signed: number | "";
  // New fields
  submission_email: string;
  deal_types: string[];
  looking_for: string;
};

type Props = {
  values: RecordLabelFormValues;
  onChange: <K extends keyof RecordLabelFormValues>(
    key: K,
    value: RecordLabelFormValues[K],
  ) => void;
};

const DEAL_TYPE_OPTIONS = [
  { value: "traditional", label: "Traditional Advance" },
  { value: "licensing", label: "Licensing" },
  { value: "distribution", label: "Distribution Only" },
  { value: "publishing", label: "Publishing" },
  { value: "single_deal", label: "Single Deal" },
];

export function RecordLabelForm({ values, onChange }: Props) {
  return (
    <div className="space-y-4">
      <TextField
        id="label_name"
        label="Label Name"
        value={values.label_name}
        onChange={(v) => onChange("label_name", v)}
        required
      />
      <SelectField
        id="label_type"
        label="Label Type"
        value={values.label_type}
        onChange={(v) => onChange("label_type", v as RecordLabelFormValues["label_type"])}
        required
        options={[
          { value: "indie", label: "Independent" },
          { value: "major", label: "Major" },
          { value: "distributed", label: "Distributed" },
          { value: "other", label: "Other" },
        ]}
      />
      <GenreMultiSelect
        id="genres_focus"
        label="Genres Focus"
        value={values.genres_focus}
        onChange={(v) => onChange("genres_focus", v)}
        required
      />
      <NumberField
        id="artists_signed"
        label="Artists Currently Signed"
        value={values.artists_signed}
        onChange={(v) => onChange("artists_signed", v)}
        required
        min={0}
      />
      <TextField
        id="submission_email"
        label="Demo Submission Email"
        type="email"
        value={values.submission_email}
        onChange={(v) => onChange("submission_email", v)}
        required
        autoComplete="email"
        placeholder="demos@yourlabel.com"
        hint="Where artists send their music. Required so bands know how to reach you."
      />
      <MultiSelectChips
        id="deal_types"
        label="Deal Types Offered"
        value={values.deal_types}
        onChange={(v) => onChange("deal_types", v)}
        options={DEAL_TYPE_OPTIONS}
        hint="Optional: pick all that apply"
      />
      <TextareaField
        id="looking_for"
        label="What You're Looking For"
        value={values.looking_for}
        onChange={(v) => onChange("looking_for", v)}
        maxLength={300}
        rows={3}
        placeholder="e.g., Indie rock acts with strong original songwriting and an existing local following."
        hint={`Optional A&R brief: ${values.looking_for.length}/300`}
      />
    </div>
  );
}
