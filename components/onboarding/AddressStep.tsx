"use client";

import { useState } from "react";
import { isValidTexasZip, TEXAS_ZIP_HELP } from "@/lib/address/texas";

export type ValidatedAddress = {
  street_address: string;
  address_line_2: string | null;
  /** Any Texas city — see lib/address/texas.ts for why this isn't "Austin". */
  city: string;
  state: "TX";
  zip_code: string;
  formatted_address: string;
};

type Props = {
  initial: Partial<ValidatedAddress> | null;
  saving: boolean;
  parentError: string | null;
  onBack: () => void;
  onConfirmed: (validated: ValidatedAddress) => void;
};

export function AddressStep({
  initial,
  saving,
  parentError,
  onBack,
  onConfirmed,
}: Props) {
  const [streetAddress, setStreetAddress] = useState(
    initial?.street_address ?? "",
  );
  const [addressLine2, setAddressLine2] = useState(
    initial?.address_line_2 ?? "",
  );
  // Deliberately not prefilled with "Austin" even though most members are
  // there: a prefilled city is one someone out of town can leave in by
  // accident, and this field is the only record of where they actually are.
  const [city, setCity] = useState(initial?.city ?? "");
  const [zipCode, setZipCode] = useState(initial?.zip_code ?? "");
  const [error, setError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedStreet = streetAddress.trim();
    const trimmedLine2 = addressLine2.trim();
    const trimmedCity = city.trim();
    const trimmedZip = zipCode.trim();

    const streetOk = trimmedStreet.length > 0;
    const cityOk = trimmedCity.length > 0;
    const zipOk = isValidTexasZip(trimmedZip);

    setCityError(cityOk ? null : "Enter your city.");
    setZipError(zipOk ? null : TEXAS_ZIP_HELP);

    if (!streetOk || !cityOk || !zipOk) {
      setError("Please fill in your street address, city, and a Texas ZIP code.");
      return;
    }

    setError(null);
    const formatted = [
      trimmedStreet,
      trimmedLine2,
      `${trimmedCity}, TX`,
      trimmedZip,
    ]
      .filter(Boolean)
      .join(", ");

    onConfirmed({
      street_address: trimmedStreet,
      address_line_2: trimmedLine2 || null,
      city: trimmedCity,
      state: "TX",
      zip_code: trimmedZip,
      formatted_address: formatted,
    });
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Where are you based?</h1>
        <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
          Anywhere in Texas works, plenty of players drive in for Austin gigs.
          Shows, venues, and everything in the app stay focused on Austin.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="street_address" className="label-text">
            Street Address
            <span className="ml-1 text-brand-orange">*</span>
          </label>
          <input
            id="street_address"
            name="street_address"
            type="text"
            required
            autoComplete="address-line1"
            placeholder="e.g., 123 Main Street"
            value={streetAddress}
            onChange={(event) => {
              setStreetAddress(event.target.value);
              setError(null);
            }}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="address_line_2" className="label-text">
            Address Line 2{" "}
            <span className="text-xs font-normal text-brand-gray-400">
              (optional)
            </span>
          </label>
          <input
            id="address_line_2"
            name="address_line_2"
            type="text"
            autoComplete="address-line2"
            placeholder="e.g., Suite 100, Apt 5"
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
            className="input-field"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label htmlFor="city" className="label-text">
              City
              <span className="ml-1 text-brand-orange">*</span>
            </label>
            <input
              id="city"
              name="city"
              type="text"
              required
              autoComplete="address-level2"
              placeholder="e.g., Austin"
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setCityError(null);
                setError(null);
              }}
              className={`input-field ${
                cityError ? "border-red-500 focus:border-red-500" : ""
              }`}
              aria-invalid={cityError ? "true" : "false"}
              aria-describedby={cityError ? "city_error" : undefined}
            />
            {cityError ? (
              <p id="city_error" className="mt-1 text-sm text-red-400">
                {cityError}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="state" className="label-text">
              State
            </label>
            {/* Still locked: Texas is the actual membership boundary, and
                showing it fixed makes that constraint obvious rather than
                letting someone type a state that would then be rejected. */}
            <input
              id="state"
              name="state"
              type="text"
              value="TX"
              disabled
              readOnly
              className="input-field cursor-not-allowed bg-brand-gray-800 text-brand-gray-300"
              aria-label="State (locked to Texas)"
            />
          </div>
        </div>

        <div>
          <label htmlFor="zip_code" className="label-text">
            ZIP Code
            <span className="ml-1 text-brand-orange">*</span>
          </label>
          <input
            id="zip_code"
            name="zip_code"
            type="text"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            required
            autoComplete="postal-code"
            placeholder="e.g., 78704"
            value={zipCode}
            onChange={(event) => {
              const next = event.target.value.replace(/[^0-9]/g, "").slice(0, 5);
              setZipCode(next);
              setZipError(null);
              setError(null);
            }}
            className={`input-field max-w-[180px] ${
              zipError ? "border-red-500 focus:border-red-500" : ""
            }`}
            aria-invalid={zipError ? "true" : "false"}
            aria-describedby={zipError ? "zip_code_error" : undefined}
          />
          {zipError ? (
            <p id="zip_code_error" className="mt-1 text-sm text-red-400">
              {zipError}
            </p>
          ) : (
            <p className="mt-1 text-xs text-brand-gray-400">
              Any Texas ZIP code.
            </p>
          )}
        </div>

        {error || parentError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {error ?? parentError}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={onBack} className="btn-secondary">
            Back
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary sm:min-w-[180px]"
          >
            {saving ? "Saving…" : "Validate Address"}
          </button>
        </div>
      </form>
    </div>
  );
}
