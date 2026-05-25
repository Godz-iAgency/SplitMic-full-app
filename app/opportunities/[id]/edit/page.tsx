import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { getPostDetail } from "@/lib/supabase/marketplace";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { PostEditForm } from "@/components/opportunities/PostEditForm";
import type { PlayerType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditOpportunityPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (!isComplete || !profile) redirect("/onboarding");

  const { post } = await getPostDetail(supabase, params.id);
  if (!post) notFound();

  // Ownership check — only the poster can edit.
  if (post.poster_user_id !== user.id) {
    redirect(`/opportunities/${params.id}`);
  }

  const playerType = profile.player_type as PlayerType;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-20">
      <header className="flex items-center justify-between border-b border-white/10 shadow-sm shadow-black/40 px-5 py-4 sm:px-8">
        <Link href="/opportunities">
          <Logo className="text-2xl" />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/opportunities/${params.id}`}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back to post
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Edit post
          </h1>
          <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
            Update the details below. Changes are saved instantly and visible
            to everyone.
          </p>
        </div>

        <PostEditForm
          postId={post.id}
          postType={post.post_type}
          playerType={playerType}
          initial={{
            title: post.title,
            description: post.description ?? "",
            event_date: post.event_date ?? "",
            event_end_date: post.event_end_date ?? "",
            event_location: post.event_location ?? "",
            open_until: post.open_until ?? "",
            genres: post.genres ?? [],
            pay_info: post.pay_info ?? "",
            player_types_wanted:
              (post.player_types_wanted as PlayerType[]) ?? [],
          }}
        />
      </section>
    </main>
  );
}
