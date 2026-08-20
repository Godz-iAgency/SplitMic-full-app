import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { AppHeader } from "@/components/AppHeader";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export const dynamic = "force-dynamic";

/**
 * SplitMic AI — a conversational way into the same data the directory, search,
 * and /live pages already expose. Available to every completed account, not a
 * single player type: a band asking for venues and a venue asking for bands are
 * both first-class here.
 *
 * This gate only controls what renders. `askAssistant` re-checks auth and the
 * usage limit itself, because a server action is a public endpoint.
 */
export default async function AssistantPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!profile || !isComplete) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-28 lg:pb-20">
      <AppHeader active="assistant" profileId={profile.profile_id} />

      <section className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-orange/30 bg-brand-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-orange">
            <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
            SplitMic AI
          </span>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
            Tell SplitMic what you need
          </h1>
          <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
            Ask for bands, venues, rehearsal rooms, gear, or tonight&apos;s
            shows. Every result is a real SplitMic record — nothing invented.
          </p>
        </div>

        <AssistantChat />
      </section>
    </main>
  );
}
