// Client-side file validation for profile media.
// Returns null if the file is valid, otherwise a friendly error message.

export type MediaKind = "avatar" | "banner" | "gallery" | "video";

export type ValidationError = {
  code: string;
  message: string;
};

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

// Pre-compression upload caps. Compression brings these way down.
export const IMAGE_MAX_BYTES_BEFORE_COMPRESSION = 25 * 1024 * 1024; // 25 MB
export const VIDEO_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
export const VIDEO_MAX_SECONDS = 15;

export const ACCEPT_IMAGE = IMAGE_MIME_TYPES.join(",");
export const ACCEPT_VIDEO = VIDEO_MIME_TYPES.join(",");

// File extensions we recognize as HEIC even when the browser reports an empty MIME
const HEIC_EXTENSIONS = [".heic", ".heif"];

function isHeic(file: File): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  const name = file.name.toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export async function validateMedia(
  file: File,
  kind: MediaKind,
): Promise<ValidationError | null> {
  if (kind === "video") {
    if (!VIDEO_MIME_TYPES.includes(file.type)) {
      return {
        code: "unsupported_video_format",
        message: "Unsupported video format. Use MP4, MOV, or WebM.",
      };
    }
    if (file.size > VIDEO_MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return {
        code: "video_too_large",
        message: `Video is ${mb} MB. Maximum is 25 MB.`,
      };
    }
    let duration: number;
    try {
      duration = await getVideoDuration(file);
    } catch {
      return {
        code: "video_unreadable",
        message: "Could not read video. Try a different file.",
      };
    }
    if (duration > VIDEO_MAX_SECONDS + 0.5) {
      return {
        code: "video_too_long",
        message: `Video is ${Math.round(duration)}s. Maximum is 15 seconds.`,
      };
    }
    return null;
  }

  // Image (avatar / banner / gallery)
  if (isHeic(file)) {
    return {
      code: "unsupported_heic",
      message:
        "iPhone HEIC photos aren't supported. Fix: open Settings → Camera → Formats → choose 'Most Compatible'. New photos will save as JPG. Or use a JPG/PNG/WebP version of this photo.",
    };
  }

  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    return {
      code: "unsupported_image_format",
      message: `Unsupported format (${file.type || "unknown"}). Use JPG, PNG, or WebP.`,
    };
  }
  if (file.size > IMAGE_MAX_BYTES_BEFORE_COMPRESSION) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      code: "image_too_large",
      message: `Image is ${mb} MB. Maximum is 25 MB. Try saving a smaller version first.`,
    };
  }
  return null;
}

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video metadata"));
    };
    video.src = url;
  });
}
