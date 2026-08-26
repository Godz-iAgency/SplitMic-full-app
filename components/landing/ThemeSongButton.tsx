"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2, ExternalLink } from "lucide-react";

/**
 * Plays the SplitMic Anthem from YouTube with no visible player.
 *
 * Why no modal: the video is a static logo card with no motion, so a modal
 * would hand the viewer a black rectangle to stare at while interrupting the
 * page. The song is the payload, not the picture. The button itself carries
 * the playing state instead, which keeps the landing page undisturbed.
 *
 * Why YouTube rather than an <audio> tag: we do not host the audio, and
 * embedded plays count toward the video's own view total, which is the point
 * of promoting it. The iframe is the supported way to do that.
 *
 * The IFrame Player API script is fetched on the FIRST CLICK, never on page
 * load. This is a public SEO landing page, so it must not pay ~50KB plus a
 * third-party connection for a control most visitors never press.
 */

/** "SplitMic Anthem" — confirmed public and embeddable via YouTube's oEmbed. */
const THEME_SONG_VIDEO_ID = "Am4W2yZEzp4";
const THEME_SONG_URL = `https://www.youtube.com/watch?v=${THEME_SONG_VIDEO_ID}`;

/** Long enough for a slow phone connection, short enough to not hang forever. */
const API_TIMEOUT_MS = 10_000;

type PlaybackState = "idle" | "loading" | "playing" | "paused" | "unavailable";

// Minimal shape of the parts of YouTube's IFrame Player API used here.
// Declared inline rather than adding @types/youtube for one component, which
// matches how every other external service in this repo is typed.
type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
};

type YouTubePlayerEvent = { target: YouTubePlayer; data?: number };

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: YouTubePlayerEvent) => void;
        onStateChange?: (event: YouTubePlayerEvent) => void;
        onError?: (event: YouTubePlayerEvent) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Module-level so a remount never downloads the script twice. YouTube calls
 * `onYouTubeIframeAPIReady` exactly once per page, so the promise, not the
 * callback, is what later callers await.
 */
let apiLoader: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (apiLoader) return apiLoader;

  apiLoader = new Promise<YouTubeApi>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const timeout = window.setTimeout(
      () => reject(new Error("YouTube player timed out")),
      API_TIMEOUT_MS,
    );

    // Chained rather than overwritten: another embed on the page may have
    // already registered its own handler, and clobbering it would break it.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API loaded without a Player"));
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Could not reach YouTube"));
    };
    document.head.appendChild(script);
  });

  // A failure must not be cached: an ad blocker or a dropped connection now
  // does not mean the next attempt fails too.
  apiLoader.catch(() => {
    apiLoader = null;
  });

  return apiLoader;
}

export function ThemeSongButton() {
  const [state, setState] = useState<PlaybackState>("idle");
  const playerRef = useRef<YouTubePlayer | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  // Audio must stop when the page does. Navigating to /live or /directory
  // unmounts this nav, which lands here and tears the player down.
  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  const toggle = useCallback(async () => {
    if (state === "loading") return;

    // Embed blocked or unreachable: this click has a live user gesture, so
    // opening the real YouTube page now actually works rather than being
    // swallowed by the popup blocker.
    if (state === "unavailable") {
      window.open(THEME_SONG_URL, "_blank", "noopener,noreferrer");
      return;
    }

    if (playerRef.current) {
      if (state === "playing") playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
      return;
    }

    setState("loading");
    try {
      const YT = await loadYouTubeApi();
      const host = hostRef.current;
      if (!host) return;

      // YT.Player REPLACES the element it is given with an iframe, so it gets
      // a throwaway child rather than the ref'd host itself.
      const mountPoint = document.createElement("div");
      host.appendChild(mountPoint);

      playerRef.current = new YT.Player(mountPoint, {
        videoId: THEME_SONG_VIDEO_ID,
        playerVars: {
          // autoplay is honoured because this whole path began with a real
          // click; the browser's autoplay policy is satisfied by that gesture,
          // and YouTube's embed grants itself `allow="autoplay"`.
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          // Required on iOS, which otherwise takes over the whole screen with
          // its native fullscreen player.
          playsinline: 1,
        },
        events: {
          // autoplay alone is unreliable across browsers; calling play on
          // ready is the belt to its braces.
          onReady: (event) => event.target.playVideo(),
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) setState("playing");
            else if (event.data === YT.PlayerState.PAUSED) setState("paused");
            // Treated as paused so the button offers a replay rather than
            // sitting in a dead "finished" state.
            else if (event.data === YT.PlayerState.ENDED) setState("paused");
          },
          onError: () => setState("unavailable"),
        },
      });
    } catch {
      setState("unavailable");
    }
  }, [state]);

  const { Icon, label } = describe(state);
  const isPlaying = state === "playing";

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={isPlaying}
        title={label}
        className={`tappable flex shrink-0 items-center justify-center rounded-full p-2.5 transition-colors ${
          isPlaying
            ? "bg-brand-orange/15 text-brand-orange"
            : "text-brand-orange/80 hover:bg-white/5 hover:text-brand-orange"
        }`}
      >
        <Icon
          className={`h-4 w-4 ${state === "loading" ? "animate-spin" : ""}`}
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </button>

      {/* The player itself. Kept in the layout at a real (if tiny) size and
          faded out rather than `display: none`, because a display-none iframe
          is treated as not rendered and browsers can refuse to play it. */}
      <div
        ref={hostRef}
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
      />

      {/* State changes are announced for screen readers, which otherwise get
          nothing back from a button whose only feedback is audio. */}
      <span className="sr-only" role="status" aria-live="polite">
        {isPlaying ? "SplitMic Anthem playing" : ""}
      </span>
    </>
  );
}

function describe(state: PlaybackState): {
  Icon: typeof Play;
  label: string;
} {
  switch (state) {
    case "loading":
      return { Icon: Loader2, label: "Loading the SplitMic Anthem" };
    case "playing":
      return { Icon: Pause, label: "Pause the SplitMic Anthem" };
    case "unavailable":
      return { Icon: ExternalLink, label: "Open the SplitMic Anthem on YouTube" };
    default:
      return { Icon: Play, label: "Play the SplitMic Anthem" };
  }
}
