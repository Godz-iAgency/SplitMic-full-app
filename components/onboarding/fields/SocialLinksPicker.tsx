"use client";

import { useRef, useState } from "react";
import { TextField } from "./TextField";
import {
  SOCIAL_PLATFORMS,
  type SocialPlatformId,
  type SocialValues,
} from "@/lib/profile/socialLinks";

type Props = {
  values: SocialValues;
  onChange: <K extends keyof SocialValues>(key: K, value: string) => void;
};

/**
 * "Which of these do you have?" instead of six blank inputs.
 *
 * The old form showed an input for every platform whether or not the person
 * used it, which made a band with one Instagram account scroll past five dead
 * fields. Asking first and revealing only what they picked is the same
 * information at a fraction of the visible surface.
 *
 * Deselecting a platform CLEARS its value rather than merely hiding it. A
 * hidden-but-retained value would still be saved, so the form would keep
 * publishing a link the user had visibly removed.
 */
export function SocialLinksPicker({ values, onChange }: Props) {
  // Anything already filled in starts selected, so the edit form opens showing
  // exactly the platforms this profile actually uses.
  const [selected, setSelected] = useState<Set<SocialPlatformId>>(() => {
    const initial = new Set<SocialPlatformId>();
    for (const platform of SOCIAL_PLATFORMS) {
      if (values[platform.field]?.trim()) initial.add(platform.id);
    }
    return initial;
  });

  /**
   * The ref, not the state value, is the authority on what is currently
   * selected. Two constraints collide here and this is what satisfies both:
   *
   * - `onChange` (a parent setState) must NOT run inside a `setSelected`
   *   updater. Updaters must be pure and React may run them twice, which
   *   fires the parent update twice and warns about updating one component
   *   while rendering another.
   * - Reading `selected` straight from the closure instead goes stale: two
   *   toggles inside one React batch both read the pre-batch value, so the
   *   first one's change is silently discarded. Observed directly — toggling
   *   one chip off and another on in the same tick lost the toggle-off.
   *
   * A ref is updated synchronously, so it is correct in both cases.
   */
  const selectedRef = useRef(selected);

  function toggle(id: SocialPlatformId) {
    const platform = SOCIAL_PLATFORMS.find((p) => p.id === id);
    if (!platform) return;

    const wasOn = selectedRef.current.has(id);
    const next = new Set(selectedRef.current);
    if (wasOn) next.delete(id);
    else next.add(id);

    selectedRef.current = next;
    setSelected(next);

    // Deselecting clears the value, so a removed platform is genuinely
    // removed rather than hidden and silently saved anyway.
    if (wasOn) onChange(platform.field, "");
  }

  const active = SOCIAL_PLATFORMS.filter((p) => selected.has(p.id));

  return (
    <div>
      <span className="label-text">Where can people find you?</span>
      <div
        role="group"
        aria-label="Social platforms you use"
        className="flex flex-wrap gap-2 rounded-lg border border-white/15 bg-brand-gray-900 p-3"
      >
        {SOCIAL_PLATFORMS.map((platform) => {
          const isOn = selected.has(platform.id);
          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => toggle(platform.id)}
              aria-pressed={isOn}
              className={`tappable rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                isOn
                  ? "border-brand-orange bg-brand-orange text-white"
                  : "border-white/20 bg-transparent text-brand-gray-300 hover:border-white/50 hover:text-white"
              }`}
            >
              {platform.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-brand-gray-400">
        Optional. Tap the ones you have and we&rsquo;ll ask for just those.
      </p>

      {active.length > 0 ? (
        <div className="mt-4 space-y-4">
          {active.map((platform) => (
            <TextField
              key={platform.id}
              id={platform.field}
              label={platform.inputLabel}
              value={values[platform.field]}
              onChange={(v) =>
                onChange(
                  platform.field,
                  // Handles are stored bare; a pasted "@name" is the most
                  // common way people type one.
                  platform.hint ? v.replace(/^@/, "") : v,
                )
              }
              placeholder={platform.placeholder}
              hint={platform.hint}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
