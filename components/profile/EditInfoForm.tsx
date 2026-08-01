"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerType } from "@/lib/types";
import { CommonFields, type CommonFieldValues } from "@/components/onboarding/forms/CommonFields";
import { BandForm, type BandFormValues } from "@/components/onboarding/forms/BandForm";
import { VenueForm, type VenueFormValues } from "@/components/onboarding/forms/VenueForm";
import { TalentBuyerForm, type TalentBuyerFormValues } from "@/components/onboarding/forms/TalentBuyerForm";
import { RecordLabelForm, type RecordLabelFormValues } from "@/components/onboarding/forms/RecordLabelForm";
import { FestivalForm, type FestivalFormValues } from "@/components/onboarding/forms/FestivalForm";
import type { ProfilePayload } from "@/components/onboarding/ProfileStep";
import { saveProfileInfo } from "@/app/profile/edit/actions";
import { publishProfile } from "@/app/profile/[id]/actions";

export type SpecificValues =
  | BandFormValues
  | VenueFormValues
  | TalentBuyerFormValues
  | RecordLabelFormValues
  | FestivalFormValues;

/** Imperative handle so a sibling button can trigger this form's save.
 *  Resolves true on success (navigating away — caller should leave its own
 *  "saving" UI as-is rather than reset it), false on failure (caller should
 *  reset so the user can retry). */
export type EditInfoFormHandle = { save: () => Promise<boolean> };

type Props = {
  profileId: string;
  playerType: PlayerType;
  initialCommon: CommonFieldValues;
  initialSpecific: SpecificValues;
  /** The first pass through /profile/edit, right after onboarding: publish as
   *  part of this save so a new user doesn't land on an unpublished profile
   *  and have to find the Publish control themselves. */
  autoPublishOnSave?: boolean;
};

function EditInfoFormInner(
  {
    profileId,
    playerType,
    initialCommon,
    initialSpecific,
    autoPublishOnSave = false,
  }: Props,
  ref: React.ForwardedRef<EditInfoFormHandle>,
) {
  const router = useRouter();
  const [common, setCommon] = useState<CommonFieldValues>(initialCommon);
  const [specific, setSpecific] = useState<SpecificValues>(initialSpecific);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateCommon<K extends keyof CommonFieldValues>(
    key: K,
    value: CommonFieldValues[K],
  ) {
    setCommon((prev) => ({ ...prev, [key]: value }));
  }

  // Persist every field, then go to the public profile. Exposed via the
  // imperative handle below so the "Done" button in the photos section runs
  // this exact save — edits are never dropped, whichever button the user
  // clicks to finish.
  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);

    const payload = {
      kind: playerType,
      common,
      specific,
    } as ProfilePayload;

    const result = await saveProfileInfo(profileId, payload);

    if (result.error) {
      setSaving(false);
      setError(result.error);
      return false;
    }

    // Best-effort: if this silently fails, the profile stays unpublished and
    // the Publish toggle at the top of the profile page still shows "Publish"
    // — the user isn't stuck, they just get the manual path instead.
    if (autoPublishOnSave) {
      await publishProfile(profileId);
    }

    // Deliberately leave `saving` true: this component is about to unmount
    // once the navigation below lands. Resetting it first flipped the button
    // back to its normal, clickable state for a frame — visible as the whole
    // page flashing back to the edit form before the profile page took over.
    router.push(`/profile/${profileId}`);
    return true;
  }

  useImperativeHandle(ref, () => ({ save }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await save();
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
          {saving
            ? "Saving…"
            : autoPublishOnSave
              ? "Save & publish my profile"
              : "Save & view profile"}
        </button>

      </div>
    </form>
  );
}

export const EditInfoForm = forwardRef(EditInfoFormInner);
