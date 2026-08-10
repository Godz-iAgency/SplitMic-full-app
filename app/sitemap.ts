import type { MetadataRoute } from "next";
import {
  CATEGORY_META,
  DIRECTORY_CATEGORIES,
} from "@/lib/directory/categories";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://splitmic.com";

/**
 * Only public, no-login pages belong here. Everything behind auth (/search,
 * /inbox, /profile/*, /admin/*) is deliberately excluded — listing it would
 * just send crawlers to a login redirect.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}/live`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/directory`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...DIRECTORY_CATEGORIES.map((category) => ({
      url: `${SITE_URL}/directory/${CATEGORY_META[category].slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
