import type { VideoEmbed } from "@/lib/media/videoEmbed";

/**
 * Renders one resolved video embed. Shared by the public profile page and the
 * editor's live preview so what an owner previews is exactly what visitors get.
 *
 * Server-component-safe (no hooks, no "use client") — the public profile page
 * is a server component and should stay that way.
 */
export function VideoEmbedFrame({
  embed,
  title = "Intro video",
  className = "",
}: {
  embed: VideoEmbed;
  title?: string;
  className?: string;
}) {
  // A direct file plays in a native <video> element rather than an iframe.
  // That's the whole reason any host is allowed for this case: there's no
  // embedded page, so nothing can render a fake login form on our domain.
  if (embed.kind === "file") {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-lg shadow-black/50 ${className}`}
      >
        <video
          src={embed.embedUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-lg shadow-black/50 ${className}`}
    >
      <iframe
        src={embed.embedUrl}
        title={`${title} (${embed.providerLabel})`}
        // Audio players are a fixed-height bar; video wants a 16:9 frame.
        className={embed.isAudio ? "h-[152px] w-full" : "aspect-video w-full"}
        // The standard set every major player needs to run inline and go
        // fullscreen. Nothing here grants access to the parent page.
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        // Don't leak the viewer's exact profile URL to the video host.
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  );
}
