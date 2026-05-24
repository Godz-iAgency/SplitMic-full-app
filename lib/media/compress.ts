import imageCompression from "browser-image-compression";
import type { MediaKind } from "./validate";

type ImageKind = Exclude<MediaKind, "video">;

const COMPRESSION_OPTIONS: Record<
  ImageKind,
  { maxSizeMB: number; maxWidthOrHeight: number }
> = {
  avatar: { maxSizeMB: 0.5, maxWidthOrHeight: 800 },
  banner: { maxSizeMB: 1.0, maxWidthOrHeight: 2400 },
  gallery: { maxSizeMB: 0.8, maxWidthOrHeight: 2000 },
};

/**
 * Compress an image client-side before upload.
 * - Resizes to the kind-specific max dimension
 * - Re-encodes as JPEG at ~85% quality
 * - Runs in a Web Worker so the UI stays responsive
 */
export async function compressImage(
  file: File,
  kind: ImageKind,
): Promise<File> {
  const options = {
    ...COMPRESSION_OPTIONS[kind],
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.85,
  };
  const compressed = await imageCompression(file, options);
  // Ensure the returned File has a .jpg extension since we forced JPEG
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([compressed], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
