import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { AppHeader } from "@/components/AppHeader";
import { ProfileIncompleteBanner } from "@/components/ProfileIncompleteBanner";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";
import { PLAYER_TYPE_DETAILS } from "@/components/landing/playerTypeDetails";

export const dynamic = "force-dynamic";

/**
 * Authenticated home / browse hub. Mirrors the landing "Built for the whole
 * scene" section but lives inside the app: each player-type card carries its
 * photo and links straight into the filtered Discover view.
 */
export default async function HomePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Open to signed-up users mid-onboarding (see the note in app/search/page.tsx).
  // This page is a pure browse hub: static category cards linking into Discover.
  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!profile) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-24 lg:pb-20">
      <AppHeader active="home" profileId={profile.profile_id} />

      {!isComplete ? <ProfileIncompleteBanner /> : null}

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Welcome to <span className="text-brand-orange">SplitMic</span>
          </h1>
          <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
            Pick who you want to explore. Every profile is verified Austin.
          </p>
        </div>

        {/* Player-type cards — single column until large desktop */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLAYER_TYPE_DETAILS.map((type) => (
            <Link
              key={type.type}
              href={`/search?type=${type.type}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-brand-gray-800 bg-brand-gray-900/50 transition hover:-translate-y-1 hover:border-brand-orange hover:bg-brand-gray-900 hover:shadow-lg hover:shadow-brand-orange/20"
            >
              {/* Photo */}
              <div className="relative aspect-[16/9] w-full overflow-hidden lg:aspect-[5/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={type.image}
                  alt={type.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-brand-gray-900 via-brand-gray-900/30 to-transparent"
                />
                <div className="absolute bottom-3 left-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-orange/40 bg-black/70 text-brand-orange shadow-lg shadow-black/40 backdrop-blur transition group-hover:scale-110">
                  <PlayerTypeIcon
                    type={type.type}
                    className="h-5 w-5"
                    strokeWidth={1.75}
                  />
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold text-white">{type.name}</h3>
                <p className="mt-1 flex-1 text-sm text-brand-gray-300">
                  {type.headline}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-gray-400 transition group-hover:text-brand-orange">
                  Browse {type.name.toLowerCase()}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}

          {/* Browse everyone */}
          <Link
            href="/search?type=all"
            className="group flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-gray-700 bg-brand-gray-900/30 p-8 text-center transition hover:-translate-y-1 hover:border-brand-orange hover:bg-brand-gray-900"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-orange/40 bg-brand-orange/10 text-brand-orange transition group-hover:scale-110">
              <Users className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-white">Browse everyone</h3>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-gray-400 transition group-hover:text-brand-orange">
              See all of Austin
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
