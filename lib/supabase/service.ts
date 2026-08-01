import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * SECURITY: This client must only ever be created inside server-side code that
 * has already verified the caller is an admin. It reads SUPABASE_SERVICE_ROLE_KEY,
 * which has NO `NEXT_PUBLIC_` prefix, so Next.js will never ship it to the browser
 * bundle — if this module were imported by a Client Component the key would be
 * undefined and this function would throw.
 *
 * Never expose the returned client to the client, and never pass user-controlled
 * input into a query without scoping it yourself — RLS is off here.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Service-role client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      // Next's App Router caches fetch() by default, and supabase-js issues its
      // queries through fetch. Without this, any code path that runs the SAME
      // query repeatedly keeps getting the first response back: the scheduled
      // cleanup job would see a stale empty result set every run after the
      // first and silently delete nothing, and admin screens would show stale
      // rows. Verified — not theoretical.
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
