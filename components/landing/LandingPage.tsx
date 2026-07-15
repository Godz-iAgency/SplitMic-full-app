import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { SceneTeaserSection, type TeaserCounts } from "./SceneTeaserSection";
import { PlayerTypesSection } from "./PlayerTypesSection";
import { FeaturesSection } from "./FeaturesSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { FinalCtaSection } from "./FinalCtaSection";
import { LandingFooter } from "./LandingFooter";
import { ScrollToTopButton } from "./ScrollToTopButton";
import type { SearchCard } from "@/lib/supabase/search";

type Props = {
  /** Live published-profile counts for the teaser — null hides the section. */
  teaserCounts?: TeaserCounts | null;
  /** Sample published profiles for the teaser grid. */
  teaserCards?: SearchCard[];
};

export function LandingPage({ teaserCounts = null, teaserCards = [] }: Props) {
  return (
    <main className="min-h-screen bg-black text-white">
      <LandingNav />
      <HeroSection />
      <SceneTeaserSection counts={teaserCounts} cards={teaserCards} />
      <PlayerTypesSection />
      <FeaturesSection />
      <HowItWorksSection />
      <FinalCtaSection />
      <LandingFooter />
      <ScrollToTopButton />
    </main>
  );
}
