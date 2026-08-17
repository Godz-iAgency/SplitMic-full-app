import { NextResponse } from "next/server";
import { isValidTexasZip, TEXAS_ZIP_HELP } from "@/lib/address/texas";

/**
 * Server-side Google-geocoding check that an address is real and in Texas.
 *
 * NOTE: nothing currently calls this — onboarding validates client-side in
 * components/onboarding/AddressStep.tsx. It's kept because it's the stricter
 * check (it confirms the street actually exists, which a ZIP range can't),
 * and updated in lockstep with the membership rule so it can be wired up
 * later without silently re-imposing the old Austin-only boundary. Both read
 * the ZIP rule from lib/address/texas.ts so the two cannot drift.
 */

type GeocodeResult = {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  address_components: {
    long_name: string;
    short_name: string;
    types: string[];
  }[];
};

type GeocodeResponse = {
  status: string;
  results: GeocodeResult[];
  error_message?: string;
};

function findComponent(result: GeocodeResult, type: string) {
  return result.address_components.find((c) => c.types.includes(type));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      address?: string;
      expected_zip?: string;
    };
    const address = body.address;
    const expectedZip = body.expected_zip;

    if (!address || typeof address !== "string" || address.trim().length < 5) {
      return NextResponse.json(
        { valid: false, error: "Please enter a complete street address." },
        { status: 400 },
      );
    }

    if (expectedZip && !isValidTexasZip(expectedZip)) {
      return NextResponse.json({ valid: false, error: TEXAS_ZIP_HELP });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: "Address validation is not configured." },
        { status: 500 },
      );
    }

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("components", "country:US|administrative_area:TX");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = (await res.json()) as GeocodeResponse;

    if (data.status !== "OK" || !data.results.length) {
      return NextResponse.json({
        valid: false,
        error:
          "We couldn't find that address. Make sure it's a real Texas street address.",
      });
    }

    const result = data.results[0];
    const city =
      findComponent(result, "locality")?.long_name ??
      findComponent(result, "postal_town")?.long_name ??
      "";
    const state =
      findComponent(result, "administrative_area_level_1")?.short_name ?? "";
    const geocodedZip = findComponent(result, "postal_code")?.long_name ?? "";
    const country = findComponent(result, "country")?.short_name ?? "";

    if (state !== "TX" || country !== "US") {
      return NextResponse.json({
        valid: false,
        error: "Address must be in Texas.",
      });
    }

    if (!isValidTexasZip(geocodedZip)) {
      return NextResponse.json({ valid: false, error: TEXAS_ZIP_HELP });
    }

    if (expectedZip && expectedZip !== geocodedZip) {
      return NextResponse.json({
        valid: false,
        error: `Google Maps returned ZIP ${geocodedZip} for that street, but you entered ${expectedZip}. Double-check your ZIP.`,
      });
    }

    return NextResponse.json({
      valid: true,
      formatted_address: result.formatted_address,
      // Returned now that any Texas city is allowed: a caller shouldn't have
      // to trust a typed-in city when the geocoder already resolved the real
      // one. (Previously the city was known to be "Austin" by definition.)
      city,
      zip: geocodedZip,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
    });
  } catch (err) {
    console.error("validate-address error:", err);
    return NextResponse.json(
      { valid: false, error: "Could not validate address. Please try again." },
      { status: 500 },
    );
  }
}
