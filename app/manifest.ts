import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SplitMic — Austin Music Industry",
    short_name: "SplitMic",
    description:
      "Austin's music industry network — connect bands, venues, talent buyers, festivals, and labels on one platform.",
    start_url: "/search",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#FF6B35",
    categories: ["music", "social", "business", "entertainment"],
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Discover",
        short_name: "Discover",
        description: "Search the Austin music ecosystem",
        url: "/search",
        icons: [{ src: "/web-app-manifest-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Feed",
        short_name: "Feed",
        description: "Browse live opportunities",
        url: "/opportunities",
        icons: [{ src: "/web-app-manifest-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Inbox",
        short_name: "Inbox",
        description: "Connection requests and messages",
        url: "/inbox",
        icons: [{ src: "/web-app-manifest-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
