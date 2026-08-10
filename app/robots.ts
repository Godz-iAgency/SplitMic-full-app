import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://splitmic.com";

/**
 * Public pages are open to every crawler, including the AI answer engines the
 * /live and /directory pages are written for. Authenticated and API routes are
 * disallowed — they only ever redirect or 401 for a crawler.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/inbox", "/onboarding", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
