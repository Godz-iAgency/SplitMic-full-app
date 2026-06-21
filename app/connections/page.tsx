import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Compass } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { getConnections } from "@/lib/supabase/messaging";
import { AppHeader } from "@/components/AppHeader";
import { ConnectionsBrowser } from "@/components/connections/ConnectionsBrowser";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!isComplete || !profile || !profile.profile_id) redirect("/onboarding");

  const connections = await getConnections(supabase, user.id);

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-24 lg:pb-20">
      <AppHeader active="profile" profileId={profile.profile_id} />

      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            Connections
            {connections.length > 0 ? (
              <span className="rounded-full bg-brand-orange/15 px-2.5 py-0.5 text-base font-bold text-brand-orange">
                {connections.length}
              </span>
            ) : null}
          </h1>
          <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
            People you&apos;ve connected with on SplitMic. Message them anytime.
          </p>
        </div>

        {connections.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
              <Users className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-white">
              No connections yet
            </h2>
            <p className="mt-2 text-sm text-brand-gray-300">
              Browse Discover, find Austin players you want to work with, and
              send a Connect request or message. Once they accept, they show up
              here.
            </p>
            <Link
              href="/search"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-black transition hover:bg-brand-orange/90"
            >
              <Compass className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              Browse Discover
            </Link>
          </div>
        ) : (
          <ConnectionsBrowser connections={connections} />
        )}
      </section>
    </main>
  );
}
