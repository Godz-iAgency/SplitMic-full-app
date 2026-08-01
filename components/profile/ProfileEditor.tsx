"use client";

import { useRef } from "react";
import { MediaManager, type MediaRow } from "./MediaManager";
import {
  EditInfoForm,
  type EditInfoFormHandle,
  type SpecificValues,
} from "./EditInfoForm";
import type { PlayerType } from "@/lib/types";
import type { CommonFieldValues } from "@/components/onboarding/forms/CommonFields";

type Props = {
  userId: string;
  profileId: string;
  media: MediaRow[];
  playerType: PlayerType;
  initialCommon: CommonFieldValues;
  initialSpecific: SpecificValues;
  /** The first pass through this page, right after onboarding. Both finish
   *  buttons publish the profile as part of their save, instead of leaving a
   *  brand-new user to find the Publish control themselves afterward. */
  autoPublishOnSave?: boolean;
};

/**
 * Wraps the two edit sections (Photos & video + Profile info) so they can share
 * one save path. The photos section's "Done" button and the info form's save
 * button both run the SAME save via the form handle below — so a profile edit
 * is never lost regardless of which button the user clicks to finish. Applies
 * to every player type (the info form swaps its fields internally by playerType).
 */
export function ProfileEditor({
  userId,
  profileId,
  media,
  playerType,
  initialCommon,
  initialSpecific,
  autoPublishOnSave = false,
}: Props) {
  const formRef = useRef<EditInfoFormHandle>(null);

  // Save the info form (persists the fields + navigates to the profile).
  const handleDone = async () => {
    await formRef.current?.save();
  };

  return (
    <>
      {/* ── Photos & Video ─────────────────────────────────────────── */}
      <section>
        <div className="mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Photos &amp; video</h1>
          <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
            Add a banner, profile photo, up to 3 gallery photos, and a
            15-second intro video.
          </p>
        </div>
        <MediaManager
          userId={userId}
          profileId={profileId}
          media={media}
          onDone={handleDone}
          publishOnDone={autoPublishOnSave}
        />
      </section>

      {/* ── Profile Info ────────────────────────────────────────────── */}
      <section>
        <div className="mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Profile info</h1>
          <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
            Update your bio, contact details, and player-specific information.
            Changes appear on your public profile immediately.
          </p>
        </div>
        <EditInfoForm
          ref={formRef}
          profileId={profileId}
          playerType={playerType}
          initialCommon={initialCommon}
          initialSpecific={initialSpecific}
          autoPublishOnSave={autoPublishOnSave}
        />
      </section>
    </>
  );
}
