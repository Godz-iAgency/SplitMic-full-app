"use client";

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
}: Props) {
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
