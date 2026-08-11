import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side upload of a remote image into Supabase Storage.
 *
 * Distinct from lib/media/upload.ts, which is the browser-side flow for a
 * user uploading their own profile media with their own session. This one runs
 * on a service-role client with no user session, for images the system
 * generates (directory website screenshots).
 *
 * Uses the existing `profile-media` bucket under a `directory/` prefix rather
 * than a new bucket, so no extra dashboard setup is needed to run a backfill.
 */

const BUCKET = "profile-media";

/** Guard against a redirect to something enormous or non-image. */
const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

export type ServerUploadResult =
  | { ok: true; publicUrl: string }
  | { ok: false; reason: string };

/**
 * Downloads `sourceUrl` and stores it at `storagePath` in the media bucket.
 * Never throws — the caller is a batch job that must keep going.
 */
export async function uploadRemoteImage(
  supabase: SupabaseClient,
  sourceUrl: string,
  storagePath: string,
): Promise<ServerUploadResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, { signal: controller.signal });
    if (!response.ok) {
      return { ok: false, reason: `Source returned ${response.status}` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return { ok: false, reason: `Source was ${contentType || "untyped"}, not an image` };
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) return { ok: false, reason: "Source was empty" };
    if (buffer.byteLength > MAX_BYTES) {
      return { ok: false, reason: "Source image is too large" };
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        // Re-running a capture for the same row should replace, not collide.
        upsert: true,
      });

    if (error) return { ok: false, reason: error.message };

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    if (!data?.publicUrl) {
      return { ok: false, reason: "Stored but could not resolve a public URL" };
    }

    return { ok: true, publicUrl: data.publicUrl };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "Timed out downloading the image"
        : "Could not download the image";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

/** Stable path per listing, so a recapture overwrites rather than accumulates. */
export function directoryScreenshotPath(businessId: string): string {
  return `directory/screenshots/${businessId}.jpg`;
}
