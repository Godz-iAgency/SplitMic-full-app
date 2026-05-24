"use client";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  hint?: string;
};

export function TextareaField({
  id,
  label,
  value,
  onChange,
  required,
  maxLength,
  rows = 4,
  placeholder,
  hint,
}: Props) {
  return (
    <div>
      <label htmlFor={id} className="label-text">
        {label}
        {required ? <span className="ml-1 text-brand-orange">*</span> : null}
      </label>
      <textarea
        id={id}
        name={id}
        value={value}
        required={required}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="input-field resize-y"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-brand-gray-400">
        <span>{hint}</span>
        {maxLength ? (
          <span>
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
    </div>
  );
}
