import { NextResponse } from "next/server";

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

function isValidAustinZip(zip: string) {
  if (!/^\d{5}$/.test(zip)) return false;
  const n = Number(zip);
  return n >= 78701 && n <= 78799;
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

    if (expectedZip && !isValidAustinZip(expectedZip)) {
      return NextResponse.json({
        valid: false,
        error: "ZIP code must be in Austin (78701-78799)",
      });
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
    url.searchParams.set("components", "country:US|administrative_area:TX|locality:Austin");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = (await res.json()) as GeocodeResponse;

    if (data.status !== "OK" || !data.results.length) {
      return NextResponse.json({
        valid: false,
        error:
          "We couldn't find that address. Make sure it's a real Austin, TX street address.",
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

    if (
      city.toLowerCase() !== "austin" ||
      state !== "TX" ||
      country !== "US"
    ) {
      return NextResponse.json({
        valid: false,
        error: "Address must be in Austin, TX. SplitMic is Austin-only.",
      });
    }

    if (!isValidAustinZip(geocodedZip)) {
      return NextResponse.json({
        valid: false,
        error: `ZIP code must be in Austin (78701-78799)`,
      });
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
