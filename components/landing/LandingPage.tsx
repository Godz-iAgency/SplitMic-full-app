import { HeroSection } from "./HeroSection";
import { PlayerTypesSection } from "./PlayerTypesSection";
import { FeaturesSection } from "./FeaturesSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { FinalCtaSection } from "./FinalCtaSection";
import { LandingFooter } from "./LandingFooter";
import { ScrollToTopButton } from "./ScrollToTopButton";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <HeroSection />
      <PlayerTypesSection />
      <FeaturesSection />
      <HowItWorksSection />
      <FinalCtaSection />
      <LandingFooter />
      <ScrollToTopButton />
    </main>
  );
}
