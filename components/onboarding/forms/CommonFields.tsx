"use client";

import { TextField } from "@/components/onboarding/fields/TextField";
import { TextareaField } from "@/components/onboarding/fields/TextareaField";
import { NumberField } from "@/components/onboarding/fields/NumberField";
import { SocialLinksPicker } from "@/components/onboarding/fields/SocialLinksPicker";
import { formatPhone } from "@/lib/format";
import type { SocialValues } from "@/lib/profile/socialLinks";
import type { FormMode } from "./mode";

/**
 * Social handles live here rather than on BandFormValues (where four of them
 * used to sit) because they are not band-specific: a venue or a festival has
 * an Instagram and a Facebook page in exactly the same way. Keeping them in one
 * place is also what lets a single picker cover every player type.
 */
export type CommonFieldValues = SocialValues & {
  full_name: string;
  bio: string;
  phone_number: string;
  website_url: string;
  instagram_followers: number | "";
};

type Props = {
  values: CommonFieldValues;
  onChange: <K extends keyof CommonFieldValues>(
    key: K,
    value: CommonFieldValues[K],
  ) => void;
  mode?: FormMode;
};

export function CommonFields({ values, onChange, mode = "full" }: Props) {
  const full = mode === "full";

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

      {/* Bio is deferred out of onboarding: it is the highest-friction field in
          the whole flow (composing prose) and the editor already generates a
          plausible one from the genres just picked, so nobody lands on an
          empty bio. See buildDefaultBio in app/profile/edit/page.tsx. */}
      {full ? (
        <TextareaField
          id="bio"
          label="Bio"
          value={values.bio}
          onChange={(v) => onChange("bio", v)}
          maxLength={500}
          rows={4}
          placeholder="Tell the Austin music community who you are."
        />
      ) : null}

      {full ? (
        <TextField
          id="phone_number"
          label="Contact Phone"
          type="tel"
          value={formatPhone(values.phone_number)}
          onChange={(v) => onChange("phone_number", formatPhone(v))}
          placeholder="(512) 555-1234"
          autoComplete="tel"
          hint="Optional"
        />
      ) : null}

      {full ? (
        <TextField
          id="website_url"
          label="Website"
          type="text"
          value={values.website_url}
          onChange={(v) => onChange("website_url", v)}
          placeholder="yoursite.com"
          hint="Optional: just type your domain, e.g. yoursite.com"
        />
      ) : null}

      <SocialLinksPicker
        values={values}
        onChange={(key, value) => onChange(key, value)}
      />

      {/* A reach metric, not a link — it feeds the Band Readiness Score, so it
          belongs with the other draw/reach numbers in the editor rather than
          in the signup path. */}
      {full ? (
        <NumberField
          id="instagram_followers"
          label="Instagram Followers"
          value={values.instagram_followers}
          onChange={(v) => onChange("instagram_followers", v)}
          min={0}
          grouped
          hint="Optional"
        />
      ) : null}
    </div>
  );
}
