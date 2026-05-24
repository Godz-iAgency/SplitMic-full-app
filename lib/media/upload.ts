import type { SupabaseClient } from "@supabase/supabase-js";
import { compressImage } from "./compress";
import {
  validateMedia,
  getVideoDuration,
  type MediaKind,
} from "./validate";

const BUCKET = "profile-media";
const UPLOAD_TIMEOUT_MS = 60_000; // 60s hard cap

export type UploadResult =
  | { ok: true; url: string; mediaId: string; storagePath: string }
  | { ok: false; error: string };

export type UploadParams = {
  file: File;
  kind: MediaKind;
  userId: string;
  profileId: string;
};

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () =>
        reject(
          new Error(
            `${label} took longer than ${Math.round(ms / 1000)} seconds. Try a smaller file or check your connection.`,
          ),
        ),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * End-to-end upload flow:
 *   1. Validate (type, size, duration)
 *   2. Compress images client-side
 *   3. For single-slot kinds (avatar / banner / video), remove the existing one first
 *   4. Upload to Supabase Storage
 *   5. Insert a profile_media row
 *   6. If row insert fails, roll back the storage upload
 */
export async function uploadProfileMedia(
  supabase: SupabaseClient,
  params: UploadParams,
): Promise<UploadResult> {
  const { file, kind, userId, profileId } = params;

  // 1. Validate
  const validationError = await validateMedia(file, kind);
  if (validationError) {
    return { ok: false, error: validationError.message };
  }

  // 2. Compress (images only) and capture video duration
  let fileToUpload: File = file;
  let durationSeconds: number | null = null;
  let width: number | null = null;
  let height: number | null = null;

  if (kind === "video") {
    durationSeconds = Math.round(await getVideoDuration(file));
  } else {
    try {
      fileToUpload = await withTimeout(
        compressImage(file, kind),
        UPLOAD_TIMEOUT_MS,
        "Compressing image",
      );
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Could not compress this image. Try a smaller file.",
      };
    }
    try {
      const dims = await getImageDimensions(fileToUpload);
      width = dims.width;
      height = dims.height;
    } catch {
      // Dimensions are nice-to-have, not fatal
    }
  }

  // 3. Single-slot kinds replace any existing entry
  if (kind === "avatar" || kind === "banner" || kind === "video") {
    const { data: existing } = await supabase
      .from("profile_media")
      .select("id, storage_path, poster_path")
      .eq("profile_id", profileId)
      .eq("kind", kind)
      .maybeSingle();

    if (existing) {
      const pathsToRemove = [existing.storage_path];
      if (existing.poster_path) pathsToRemove.push(existing.poster_path);
      await supabase.storage.from(BUCKET).remove(pathsToRemove);
      await supabase.from("profile_media").delete().eq("id", existing.id);
    }
  }

  // 4. Upload
  const ext = fileExtensionFor(fileToUpload, kind);
  const storagePath = `${userId}/${kind}-${Date.now()}.${ext}`;

  let storageError: { message: string } | null = null;
  try {
    const result = await withTimeout(
      supabase.storage.from(BUCKET).upload(storagePath, fileToUpload, {
        contentType: fileToUpload.type,
        upsert: false,
      }),
      UPLOAD_TIMEOUT_MS,
      "Upload",
    );
    storageError = result.error;
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Upload timed out. Check your connection and try again.",
    };
  }

  if (storageError) {
    return { ok: false, error: `Upload failed: ${storageError.message}` };
  }

  // 5. Insert DB row
  const { data: row, error: insertError } = await supabase
    .from("profile_media")
    .insert({
      profile_id: profileId,
      user_id: userId,
      kind,
      storage_path: storagePath,
      mime_type: fileToUpload.type,
      bytes: fileToUpload.size,
      width,
      height,
      duration_seconds: durationSeconds,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    // 6. Roll back storage on DB failure
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return {
      ok: false,
      error: insertError?.message ?? "Could not save media record.",
    };
  }

  // Build public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return { ok: true, url: publicUrl, mediaId: row.id, storagePath };
}

export async function deleteProfileMedia(
  supabase: SupabaseClient,
  mediaId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: media, error } = await supabase
    .from("profile_media")
    .select("storage_path, poster_path")
    .eq("id", mediaId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!media) return { ok: false, error: "Media not found." };

  const paths = [media.storage_path];
  if (media.poster_path) paths.push(media.poster_path);
  await supabase.storage.from(BUCKET).remove(paths);

  const { error: deleteError } = await supabase
    .from("profile_media")
    .delete()
    .eq("id", mediaId);

  if (deleteError) return { ok: false, error: deleteError.message };
  return { ok: true };
}

export function publicUrlFor(
  supabase: SupabaseClient,
  storagePath: string,
): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return publicUrl;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function fileExtensionFor(file: File, kind: MediaKind): string {
  if (kind === "video") {
    if (file.type === "video/mp4") return "mp4";
    if (file.type === "video/quicktime") return "mov";
    if (file.type === "video/webm") return "webm";
    return file.name.split(".").pop() || "mp4";
  }
  return "jpg"; // we always compress images to JPEG
}

function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}
