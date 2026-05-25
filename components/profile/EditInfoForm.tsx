"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { PlayerType } from "@/lib/types";
import { CommonFields, type CommonFieldValues } from "@/components/onboarding/forms/CommonFields";
import { BandForm, type BandFormValues } from "@/components/onboarding/forms/BandForm";
import { VenueForm, type VenueFormValues } from "@/components/onboarding/forms/VenueForm";
import { TalentBuyerForm, type TalentBuyerFormValues } from "@/components/onboarding/forms/TalentBuyerForm";
import { RecordLabelForm, type RecordLabelFormValues } from "@/components/onboarding/forms/RecordLabelForm";
import { FestivalForm, type FestivalFormValues } from "@/components/onboarding/forms/FestivalForm";
import type { ProfilePayload } from "@/components/onboarding/ProfileStep";
import { saveProfileInfo } from "@/app/profile/edit/actions";

type SpecificValues =
  | BandFormValues
  | VenueFormValues
  | TalentBuyerFormValues
  | RecordLabelFormValues
  | FestivalFormValues;

type Props = {
  profileId: string;
  playerType: PlayerType;
  initialCommon: CommonFieldValues;
  initialSpecific: SpecificValues;
};

export function EditInfoForm({
  profileId,
  playerType,
  initialCommon,
  initialSpecific,
}: Props) {
  const [common, setCommon] = useState<CommonFieldValues>(initialCommon);
  const [specific, setSpecific] = useState<SpecificValues>(initialSpecific);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateCommon<K extends keyof CommonFieldValues>(
    key: K,
    value: CommonFieldValues[K],
  ) {
    setCommon((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const payload = {
      kind: playerType,
      common,
      specific,
    } as ProfilePayload;

    const result = await saveProfileInfo(profileId, payload);

    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Common fields */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
          About you
        </h2>
        <CommonFields values={common} onChange={updateCommon} />
      </section>

      {/* Player-type-specific fields */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-gray-400">
          Details
        </h2>

        {playerType === "band" ? (
          <BandForm
            values={specific as BandFormValues}
            onChange={(key, value) =>
              setSpecific((prev) => ({ ...(prev as BandFormValues), [key]: value }))
            }
          />
        ) : null}

        {playerType === "venue" ? (
          <VenueForm
            values={specific as VenueFormValues}
            onChange={(key, value) =>
              setSpecific((prev) => ({ ...(prev as VenueFormValues), [key]: value }))
            }
          />
        ) : null}

        {playerType === "talent_buyer" ? (
          <TalentBuyerForm
            values={specific as TalentBuyerFormValues}
            onChange={(key, value) =>
              setSpecific((prev) => ({
                ...(prev as TalentBuyerFormValues),
                [key]: value,
              }))
            }
          />
        ) : null}

        {playerType === "record_label" ? (
          <RecordLabelForm
            values={specific as RecordLabelFormValues}
            onChange={(key, value) =>
              setSpecific((prev) => ({
                ...(prev as RecordLabelFormValues),
                [key]: value,
              }))
            }
          />
        ) : null}

        {playerType === "festival" ? (
          <FestivalForm
            values={specific as FestivalFormValues}
            onChange={(key, value) =>
              setSpecific((prev) => ({
                ...(prev as FestivalFormValues),
                [key]: value,
              }))
            }
          />
        ) : null}
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary sm:min-w-[180px]"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300">
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            Profile updated
          </span>
        ) : null}
      </div>
    </form>
  );
}
