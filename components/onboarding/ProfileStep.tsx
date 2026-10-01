"use client";

import { useEffect, useRef, useState } from "react";
import type { PendingProfile } from "@/lib/pendingProfile";
import type { PlayerType } from "@/lib/types";
import { CommonFields, type CommonFieldValues } from "./forms/CommonFields";
import { BandForm, type BandFormValues } from "./forms/BandForm";
import { VenueForm, type VenueFormValues } from "./forms/VenueForm";
import {
  TalentBuyerForm,
  type TalentBuyerFormValues,
} from "./forms/TalentBuyerForm";
import {
  RecordLabelForm,
  type RecordLabelFormValues,
} from "./forms/RecordLabelForm";
import { FestivalForm, type FestivalFormValues } from "./forms/FestivalForm";
import { BacklineForm, type BacklineFormValues } from "./forms/BacklineForm";
import {
  InstrumentRentalForm,
  type InstrumentRentalFormValues,
} from "./forms/InstrumentRentalForm";
import {
  RehearsalStudioForm,
  type RehearsalStudioFormValues,
} from "./forms/RehearsalStudioForm";
import { EMPTY_SOCIAL_VALUES } from "@/lib/profile/socialLinks";
import { validateProfilePayload } from "@/lib/profile/validation";

export type ProfilePayload =
  | { kind: "band"; common: CommonFieldValues; specific: BandFormValues }
  | { kind: "venue"; common: CommonFieldValues; specific: VenueFormValues }
  | {
      kind: "talent_buyer";
      common: CommonFieldValues;
      specific: TalentBuyerFormValues;
    }
  | {
      kind: "record_label";
      common: CommonFieldValues;
      specific: RecordLabelFormValues;
    }
  | {
      kind: "festival";
      common: CommonFieldValues;
      specific: FestivalFormValues;
    }
  | { kind: "backline"; common: CommonFieldValues; specific: BacklineFormValues }
  | {
      kind: "instrument_rental";
      common: CommonFieldValues;
      specific: InstrumentRentalFormValues;
    }
  | {
      kind: "rehearsal_studio";
      common: CommonFieldValues;
      specific: RehearsalStudioFormValues;
    };

type Props = {
  playerType: PlayerType;
  initialCommon: CommonFieldValues;
  initialSpecific: ProfilePayload["specific"] | null;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (payload: ProfilePayload) => void;
  onCommonChange: (values: CommonFieldValues) => void;
  onSpecificChange: (values: ProfilePayload["specific"]) => void;
};

const TITLES: Record<PlayerType, string> = {
  band: "Tell us about your band",
  venue: "Tell us about your venue",
  talent_buyer: "Tell us about your booking work",
  record_label: "Tell us about your label",
  festival: "Tell us about your festival",
  backline: "Tell us about your backline company",
  instrument_rental: "Tell us about your rental shop",
  rehearsal_studio: "Tell us about your studio",
};

const EMPTY_COMMON: CommonFieldValues = {
  ...EMPTY_SOCIAL_VALUES,
  full_name: "",
  bio: "",
  phone_number: "",
  website_url: "",
  instagram_followers: "",
};

// Smart defaults: member_count 4 and set_length 45 match the typical Austin
// act + support slot — most users scan-and-confirm instead of composing.
const EMPTY_BAND: BandFormValues = {
  band_name: "",
  genres: [],
  member_count: 4,
  sound_description: "",
  set_length_minutes: 45,
  typical_draw: "",
  email_list_size: "",
  largest_venue_capacity: "",
  tiktok_followers: "",
  youtube_followers: "",
  booking_email: "",
  booking_fee_min: "",
  booking_fee_max: "",
};

const EMPTY_VENUE: VenueFormValues = {
  venue_name: "",
  venue_type: "",
  capacity: "",
  age_restriction: "",
  genres_hosted: [],
  shows_per_week: 3,
  booking_contact_name: "",
  booking_contact_email: "",
  pay_structure: "",
  pay_min: "",
  pay_max: "",
};

const EMPTY_TALENT_BUYER: TalentBuyerFormValues = {
  company_name: "",
  company_type: "",
  genres_focus: [],
  typical_booking_fee: "",
  booking_radius_miles: "",
  contact_email: "",
  artist_budget_min: "",
  artist_budget_max: "",
  events_per_year: "",
};

const EMPTY_RECORD_LABEL: RecordLabelFormValues = {
  label_name: "",
  label_type: "",
  genres_focus: [],
  artists_signed: "",
  submission_email: "",
  deal_types: [],
  looking_for: "",
};

const EMPTY_FESTIVAL: FestivalFormValues = {
  festival_name: "",
  festival_type: "",
  festival_season: "",
  genres_featured: [],
  expected_attendance: "",
  total_band_slots: "",
  application_email: "",
  pays_bands: "",
  pay_min: "",
  pay_max: "",
};

const EMPTY_BACKLINE: BacklineFormValues = {
  business_name: "",
  equipment: [],
  delivers: "",
  service_area: "",
  price_note: "",
};

const EMPTY_INSTRUMENT_RENTAL: InstrumentRentalFormValues = {
  business_name: "",
  instruments: [],
  rental_periods: [],
  delivers: "",
  price_note: "",
};

const EMPTY_REHEARSAL_STUDIO: RehearsalStudioFormValues = {
  business_name: "",
  room_count: "",
  gear_included: [],
  rate_note: "",
  max_people_per_room: "",
  hours_note: "",
};

function emptySpecific(playerType: PlayerType): ProfilePayload["specific"] {
  switch (playerType) {
    case "band":
      return { ...EMPTY_BAND };
    case "venue":
      return { ...EMPTY_VENUE };
    case "talent_buyer":
      return { ...EMPTY_TALENT_BUYER };
    case "record_label":
      return { ...EMPTY_RECORD_LABEL };
    case "festival":
      return { ...EMPTY_FESTIVAL };
    case "backline":
      return { ...EMPTY_BACKLINE };
    case "instrument_rental":
      return { ...EMPTY_INSTRUMENT_RENTAL };
    case "rehearsal_studio":
      return { ...EMPTY_REHEARSAL_STUDIO };
  }
}

/**
 * Seed this step from the landing page's mini profile builder.
 *
 * The casts are safe: readPendingProfile only returns a `scale` that is one of
 * the values in that player type's own scaleOptions list, and those lists are
 * copies of the matching form field's options.
 */
export function specificFromPending(
  pending: PendingProfile,
): ProfilePayload["specific"] {
  switch (pending.type) {
    case "band":
      return {
        ...EMPTY_BAND,
        genres: pending.genres,
        typical_draw: pending.scale,
      };
    case "venue":
      return {
        ...EMPTY_VENUE,
        genres_hosted: pending.genres,
        venue_type: pending.scale as VenueFormValues["venue_type"],
      };
    case "talent_buyer":
      return {
        ...EMPTY_TALENT_BUYER,
        genres_focus: pending.genres,
        company_type: pending.scale as TalentBuyerFormValues["company_type"],
      };
    case "record_label":
      return {
        ...EMPTY_RECORD_LABEL,
        genres_focus: pending.genres,
        label_type: pending.scale as RecordLabelFormValues["label_type"],
      };
    case "festival":
      return {
        ...EMPTY_FESTIVAL,
        genres_featured: pending.genres,
        festival_type: pending.scale as FestivalFormValues["festival_type"],
      };
    // The landing mini builder asks about genres and scale, neither of which
    // a gear or rehearsal business has, so only the type itself carries over.
    case "backline":
    case "instrument_rental":
    case "rehearsal_studio":
      return emptySpecific(pending.type);
  }
}

export function ProfileStep({
  playerType,
  initialCommon,
  initialSpecific,
  saving,
  error,
  onBack,
  onSubmit,
  onCommonChange,
  onSpecificChange,
}: Props) {
  const [common, setCommon] = useState<CommonFieldValues>(
    initialCommon ?? EMPTY_COMMON,
  );
  const [specific, setSpecific] = useState<ProfilePayload["specific"]>(
    initialSpecific ?? emptySpecific(playerType),
  );
  // Client-side only, checked before onSubmit ever runs — see
  // lib/profile/validation.ts for why this can't be a native `required`
  // attribute on the genre picker itself.
  const [validationError, setValidationError] = useState<string | null>(null);

  // A user resuming onboarding lands straight on this step, so this component
  // can mount before the parent's mount effect has read the saved mini-builder
  // answers (child effects run first). Apply them the first time they arrive.
  // The ref makes this strictly one-shot: after that, initialSpecific is just
  // this component's own state echoed back, and re-applying it would fight the
  // user's typing.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !initialSpecific) return;
    seeded.current = true;
    setSpecific(initialSpecific);
  }, [initialSpecific]);

  function updateCommon<K extends keyof CommonFieldValues>(
    key: K,
    value: CommonFieldValues[K],
  ) {
    const next = { ...common, [key]: value };
    setCommon(next);
    onCommonChange(next);
  }

  function updateSpecific(next: ProfilePayload["specific"]) {
    setSpecific(next);
    onSpecificChange(next);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { kind: playerType, common, specific } as ProfilePayload;
    const message = validateProfilePayload(payload);
    if (message) {
      setValidationError(message);
      return;
    }
    setValidationError(null);
    onSubmit(payload);
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{TITLES[playerType]}</h1>
        <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
          Just the essentials. You can add photos, a bio, and the rest right
          after this.
        </p>
      </header>

      {/* Every form below runs in `onboarding` mode: the same components the
          editor uses, rendering only the fields a profile needs to be
          recognisable and findable. Everything else is one level deeper, on
          /profile/edit, which is where this step hands off to. */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <section>
          {playerType === "band" ? (
            <BandForm
              mode="onboarding"
              values={specific as BandFormValues}
              onChange={(key, value) => {
                const next = { ...(specific as BandFormValues), [key]: value };
                updateSpecific(next);
              }}
            />
          ) : null}
          {playerType === "venue" ? (
            <VenueForm
              mode="onboarding"
              values={specific as VenueFormValues}
              onChange={(key, value) => {
                const next = { ...(specific as VenueFormValues), [key]: value };
                updateSpecific(next);
              }}
            />
          ) : null}
          {playerType === "talent_buyer" ? (
            <TalentBuyerForm
              mode="onboarding"
              values={specific as TalentBuyerFormValues}
              onChange={(key, value) => {
                const next = {
                  ...(specific as TalentBuyerFormValues),
                  [key]: value,
                };
                updateSpecific(next);
              }}
            />
          ) : null}
          {playerType === "record_label" ? (
            <RecordLabelForm
              mode="onboarding"
              values={specific as RecordLabelFormValues}
              onChange={(key, value) => {
                const next = {
                  ...(specific as RecordLabelFormValues),
                  [key]: value,
                };
                updateSpecific(next);
              }}
            />
          ) : null}
          {playerType === "festival" ? (
            <FestivalForm
              mode="onboarding"
              values={specific as FestivalFormValues}
              onChange={(key, value) => {
                const next = {
                  ...(specific as FestivalFormValues),
                  [key]: value,
                };
                updateSpecific(next);
              }}
            />
          ) : null}
          {playerType === "backline" ? (
            <BacklineForm
              mode="onboarding"
              values={specific as BacklineFormValues}
              onChange={(key, value) => {
                const next = { ...(specific as BacklineFormValues), [key]: value };
                updateSpecific(next);
              }}
            />
          ) : null}
          {playerType === "instrument_rental" ? (
            <InstrumentRentalForm
              mode="onboarding"
              values={specific as InstrumentRentalFormValues}
              onChange={(key, value) => {
                const next = {
                  ...(specific as InstrumentRentalFormValues),
                  [key]: value,
                };
                updateSpecific(next);
              }}
            />
          ) : null}
          {playerType === "rehearsal_studio" ? (
            <RehearsalStudioForm
              mode="onboarding"
              values={specific as RehearsalStudioFormValues}
              onChange={(key, value) => {
                const next = {
                  ...(specific as RehearsalStudioFormValues),
                  [key]: value,
                };
                updateSpecific(next);
              }}
            />
          ) : null}
        </section>

        {/* Name and socials come after the type-specific fields: the person
            already answered "who are you" by picking a player type, so leading
            with their band/venue name is the more natural continuation. */}
        <section>
          <CommonFields
            mode="onboarding"
            values={common}
            onChange={updateCommon}
          />
        </section>

        {validationError || error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {validationError || error}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary"
            disabled={saving}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary sm:min-w-[200px]"
          >
            {saving ? "Saving profile…" : "Finish onboarding"}
          </button>
        </div>
      </form>
    </div>
  );
}

export const EMPTY_FORM_VALUES = {
  common: EMPTY_COMMON,
  band: EMPTY_BAND,
  venue: EMPTY_VENUE,
  talent_buyer: EMPTY_TALENT_BUYER,
  record_label: EMPTY_RECORD_LABEL,
  festival: EMPTY_FESTIVAL,
  backline: EMPTY_BACKLINE,
  instrument_rental: EMPTY_INSTRUMENT_RENTAL,
  rehearsal_studio: EMPTY_REHEARSAL_STUDIO,
};
