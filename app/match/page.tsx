import Link from "next/link";
import { redirect } from "next/navigation";
import { Ban, Sparkles } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { AppHeader } from "@/components/AppHeader";
import { ShowMatchForm } from "@/components/match/ShowMatchForm";
import type { PlayerType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Show matching — talent buyers only.
 *
 * A buyer describes the show in plain English, Gemini turns that into search
 * criteria, and we rank published bands against it with our own profile data.
 * Every other player type gets the notice below rather than a 404, so the
 * feature is discoverable as a reason to be a talent buyer here.
 *
 * The gate is repeated inside `findMatchingBands` — this one only controls
 * what renders.
 */
export default async function MatchPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!profile) redirect("/onboarding");
  if (!isComplete) redirect("/onboarding");

  const playerType = profile.player_type as PlayerType | null;
  const isTalentBuyer = playerType === "talent_buyer";

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-24 lg:pb-20">
      <AppHeader profileId={profile.profile_id} />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-orange/30 bg-brand-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-orange">
            <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
            Talent buyers
          </span>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
            Find bands for your show
          </h1>
          <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
            Describe the show the way you&apos;d describe it to a colleague. We
            read it and rank Austin bands against what you actually need, no
            filter menus.
          </p>
        </div>

        {isTalentBuyer ? (
          <ShowMatchForm />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <Ban className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">
              This one is for talent buyers
            </h2>
            <p className="mt-2 text-sm text-brand-gray-300">
              Show matching is built around booking a bill, so it&apos;s
              available to talent buyer and booking agent accounts. You can
              still browse every band on Discover.
            </p>
            <Link
              href="/search?type=band"
              className="mt-6 inline-flex rounded-full bg-brand-orange px-5 py-2 text-sm font-semibold text-black transition hover:bg-brand-orange/90"
            >
              Browse all bands
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
