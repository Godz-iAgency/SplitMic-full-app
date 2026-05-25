"use client";

import { Dropdown } from "@/components/ui/Dropdown";

type Option = { value: string; label: string };

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  required?: boolean;
  hint?: string;
};

// Match the input-field utility class look — full-width with same border/bg.
const FIELD_TRIGGER =
  "input-field flex w-full items-center justify-between gap-2 pr-3 text-left";

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  required,
  hint,
}: Props) {
  return (
    <div>
      <label htmlFor={id} className="label-text">
        {label}
        {required ? <span className="ml-1 text-brand-orange">*</span> : null}
      </label>
      <Dropdown
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Select…"
        triggerClassName={FIELD_TRIGGER}
        fullWidth
      />
      {/* Hidden mirror preserves native browser form validation (required, name). */}
      <input
        type="text"
        name={id}
        value={value}
        required={required}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      {hint ? <p className="mt-1 text-xs text-brand-gray-400">{hint}</p> : null}
    </div>
  );
}
