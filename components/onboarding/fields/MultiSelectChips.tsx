"use client";

type Option = { value: string; label: string };

type Props = {
  id: string;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  required?: boolean;
  hint?: string;
};

/**
 * Chip-style multi-select. Like GenreMultiSelect but accepts arbitrary options.
 * Use when you need a multi-pick UI for a small static list (deal types, etc.).
 */
export function MultiSelectChips({
  id,
  label,
  value,
  onChange,
  options,
  required,
  hint,
}: Props) {
  function toggle(val: string) {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="label-text">
        {label}
        {required ? <span className="ml-1 text-brand-orange">*</span> : null}
      </label>
      <div
        id={id}
        role="group"
        aria-label={label}
        className="flex flex-wrap gap-2 rounded-lg border border-white/15 bg-brand-gray-900 p-3"
      >
        {options.map((opt) => {
          const active = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-brand-orange bg-brand-orange text-white"
                  : "border-white/20 bg-transparent text-brand-gray-300 hover:border-white/50 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="mt-1 text-xs text-brand-gray-400">{hint}</p> : null}
    </div>
  );
}
