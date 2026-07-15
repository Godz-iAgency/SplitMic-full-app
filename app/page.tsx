import { LandingPage } from "@/components/landing/LandingPage";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  searchProfiles,
  getProfileCountsByType,
  type SearchCard,
} from "@/lib/supabase/search";
import type { TeaserCounts } from "@/components/landing/SceneTeaserSection";

// Revalidate the teaser data every 5 minutes — the landing page stays
// static-fast while counts drift with real signups.
export const revalidate = 300;

export default async function HomePage() {
  // Reciprocity teaser: real published profiles, shown pre-signup.
  // Server-only service client (anon visitors have no session); queries are
  // read-only and scoped to is_published rows — the same cards any signed-in
  // user sees in Discover. Best-effort: any failure just hides the section.
  let teaserCounts: TeaserCounts | null = null;
  let teaserCards: SearchCard[] = [];
  try {
    const admin = createServiceRoleClient();
    const [counts, results] = await Promise.all([
      getProfileCountsByType(admin),
      searchProfiles(admin, { playerType: "all" }),
    ]);
    teaserCounts = counts;
    teaserCards = results.cards.slice(0, 6);
  } catch {
    // Missing env or query failure — render the landing page without the teaser.
  }

  return <LandingPage teaserCounts={teaserCounts} teaserCards={teaserCards} />;
}
