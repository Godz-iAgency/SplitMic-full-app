import Link from "next/link";
import { redirect } from "next/navigation";
import { Ban } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import {
  isPostingPlayerType,
  canPostEvents,
  canPostOpenMic,
} from "@/lib/supabase/marketplace";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { PostCreationForm } from "@/components/opportunities/PostCreationForm";
import type { PlayerType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewOpportunityPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!isComplete || !profile) redirect("/onboarding");

  const playerType = profile.player_type as PlayerType;

  // Check published status
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("is_published")
    .eq("id", profile.profile_id ?? "")
    .maybeSingle();

  const isPublished = !!profileRow?.is_published;

  // Venue display name — pre-fills the open mic title ("{Venue} Open Mic").
  let posterName: string | undefined;
  if (canPostOpenMic(playerType) && profile.profile_id) {
    const { data: venueRow } = await supabase
      .from("venue_details")
      .select("venue_name")
      .eq("profile_id", profile.profile_id)
      .maybeSingle();
    posterName = venueRow?.venue_name ?? undefined;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-20">
      <header className="flex items-center justify-between border-b border-white/10 shadow-sm shadow-black/40 px-5 py-4 sm:px-8">
        <Link href="/opportunities">
          <Logo className="text-2xl" />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/opportunities"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Create a post</h1>
          <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
            Post an event you&apos;re booking, or an opportunity you&apos;re
            opening up to the Austin scene.
          </p>
        </div>

        {!isPublished ? (
          <BlockNotice
            title="Publish your profile first"
            body="Your profile must be published before you can post. Head to your profile and hit Publish."
            ctaHref={`/profile/${profile.profile_id}`}
            ctaLabel="Go to my profile"
          />
        ) : !isPostingPlayerType(playerType) ? (
          <BlockNotice
            title="Bands can't post directly"
            body="To reach a venue, label, talent buyer, or festival, send them a Connect request from their profile. They'll review it and a conversation will open if accepted."
            ctaHref="/search"
            ctaLabel="Browse profiles"
          />
        ) : (
          <PostCreationForm
            canPostEvents={canPostEvents(playerType)}
            canPostOpenMic={canPostOpenMic(playerType)}
            playerType={playerType}
            posterName={posterName}
          />
        )}
      </section>
    </main>
  );
}

function BlockNotice({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-300">
        <Ban className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-brand-gray-300">{body}</p>
      <Link
        href={ctaHref}
        className="mt-6 inline-flex rounded-full bg-brand-orange px-5 py-2 text-sm font-semibold text-black transition hover:bg-brand-orange/90"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
