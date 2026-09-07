import type { ProfilePayload } from "@/components/onboarding/ProfileStep";

/**
 * The validation gap this closes: `GenreMultiSelect`'s `required` prop only
 * renders a visual asterisk. The chip picker is a `role="group"` of plain
 * buttons, not a real form control, so it never enters the browser's native
 * constraint validation the way a `required` text/number input does — a form
 * with every genre field empty reports `checkValidity() === true`.
 *
 * Confirmed live: onboarding completed end-to-end with zero genres selected
 * and wrote a real `band_details` row with `genres: []`. Genre is core
 * matching data (Discover's filter, the AI show matcher's genre gate), so a
 * profile that slips through this way silently vanishes from every
 * genre-based search while still being fully published everywhere else.
 *
 * This is checked in application code rather than fixed by making the chip
 * picker a real form control, because both onboarding (ProfileStep.tsx) and
 * the editor (EditInfoForm.tsx) construct this exact payload shape right
 * before submitting — one validator called from both is less surface area
 * than teaching a native-input shim to behave correctly (and accessibly)
 * across five different chip pickers.
 */
export function validateProfilePayload(payload: ProfilePayload): string | null {
  if (genresFor(payload).length === 0) {
    return "Pick at least one genre.";
  }
  return null;
}

function genresFor(payload: ProfilePayload): string[] {
  switch (payload.kind) {
    case "band":
      return payload.specific.genres;
    case "venue":
      return payload.specific.genres_hosted;
    case "talent_buyer":
      return payload.specific.genres_focus;
    case "record_label":
      return payload.specific.genres_focus;
    case "festival":
      return payload.specific.genres_featured;
  }
}
