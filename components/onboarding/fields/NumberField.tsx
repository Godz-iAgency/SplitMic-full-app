"use client";

import { formatThousands, parseDigitsToNumber } from "@/lib/format";

type Props = {
  id: string;
  label: string;
  value: number | "";
  onChange: (value: number | "") => void;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  hint?: string;
  /** When true, displays thousands separators (e.g. 52,221,122) while still emitting a number. */
  grouped?: boolean;
};

export function NumberField({
  id,
  label,
  value,
  onChange,
  required,
  min,
  max,
  step,
  placeholder,
  hint,
  grouped,
}: Props) {
  // Grouped mode uses a text input because <input type="number"> cannot
  // render thousands separators. We still emit a plain number on change.
  if (grouped) {
    return (
      <div>
        <label htmlFor={id} className="label-text">
          {label}
          {required ? <span className="ml-1 text-brand-orange">*</span> : null}
        </label>
        <input
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          value={formatThousands(value)}
          required={required}
          placeholder={placeholder}
          onChange={(event) => onChange(parseDigitsToNumber(event.target.value))}
          className="input-field"
        />
        {hint ? (
          <p className="mt-1 text-xs text-brand-gray-400">{hint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="label-text">
        {label}
        {required ? <span className="ml-1 text-brand-orange">*</span> : null}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        inputMode="numeric"
        value={value === "" ? "" : value}
        required={required}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange("");
            return;
          }
          const num = Number(raw);
          onChange(Number.isNaN(num) ? "" : num);
        }}
        className="input-field"
      />
      {hint ? <p className="mt-1 text-xs text-brand-gray-400">{hint}</p> : null}
    </div>
  );
}
