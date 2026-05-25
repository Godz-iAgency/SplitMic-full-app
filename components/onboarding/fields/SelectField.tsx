"use client";

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
      <select
        id={id}
        name={id}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="input-field appearance-none bg-[length:14px] bg-[right_1rem_center] bg-no-repeat pr-10 [color-scheme:dark]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23cccccc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
        }}
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1 text-xs text-brand-gray-400">{hint}</p> : null}
    </div>
  );
}
