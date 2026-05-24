"use client";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "text" | "email" | "tel" | "url" | "date";
  placeholder?: string;
  maxLength?: number;
  hint?: string;
  autoComplete?: string;
};

export function TextField({
  id,
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  maxLength,
  hint,
  autoComplete,
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
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="input-field"
      />
      {hint ? <p className="mt-1 text-xs text-brand-gray-400">{hint}</p> : null}
    </div>
  );
}
