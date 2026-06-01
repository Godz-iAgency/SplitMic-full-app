"use client";

import { TextField } from "@/components/onboarding/fields/TextField";
import { TextareaField } from "@/components/onboarding/fields/TextareaField";
import { NumberField } from "@/components/onboarding/fields/NumberField";

export type CommonFieldValues = {
  full_name: string;
  bio: string;
  phone_number: string;
  website_url: string;
  instagram_handle: string;
  instagram_followers: number | "";
  twitter_handle: string;
};

type Props = {
  values: CommonFieldValues;
  onChange: <K extends keyof CommonFieldValues>(
    key: K,
    value: CommonFieldValues[K],
  ) => void;
};

export function CommonFields({ values, onChange }: Props) {
  return (
    <div className="space-y-4">
      <TextField
        id="full_name"
        label="Full Name"
        value={values.full_name}
        onChange={(v) => onChange("full_name", v)}
        required
        autoComplete="name"
      />
      <TextareaField
        id="bio"
        label="Bio"
        value={values.bio}
        onChange={(v) => onChange("bio", v)}
        required
        maxLength={500}
        rows={4}
        placeholder="Tell the Austin music community who you are."
      />
      <TextField
        id="phone_number"
        label="Contact Phone"
        type="tel"
        value={values.phone_number}
        onChange={(v) => onChange("phone_number", v)}
        placeholder="(512) 555-1234"
        autoComplete="tel"
        hint="Optional"
      />
      <TextField
        id="website_url"
        label="Website"
        type="text"
        value={values.website_url}
        onChange={(v) => onChange("website_url", v)}
        placeholder="yoursite.com"
        hint="Optional — just type your domain, e.g. yoursite.com"
      />
      <TextField
        id="instagram_handle"
        label="Instagram Handle"
        value={values.instagram_handle}
        onChange={(v) =>
          onChange("instagram_handle", v.startsWith("@") ? v.slice(1) : v)
        }
        placeholder="splitmicatx"
        hint="Optional — without the @"
      />
      <NumberField
        id="instagram_followers"
        label="Instagram Followers"
        value={values.instagram_followers}
        onChange={(v) => onChange("instagram_followers", v)}
        min={0}
        hint="Optional"
      />
      <TextField
        id="twitter_handle"
        label="X / Twitter Handle"
        value={values.twitter_handle}
        onChange={(v) =>
          onChange("twitter_handle", v.startsWith("@") ? v.slice(1) : v)
        }
        placeholder="splitmicatx"
        hint="Optional — without the @"
      />
    </div>
  );
}
