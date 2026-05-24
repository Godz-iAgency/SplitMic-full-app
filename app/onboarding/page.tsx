import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { isAdminEmail } from "@/lib/supabase/admin";
import {
  OnboardingFlow,
  type InitialOnboardingState,
} from "@/components/onboarding/OnboardingFlow";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Admin accounts don't go through onboarding — send them straight to /admin.
  if (isAdminEmail(user.email)) redirect("/admin");

  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  if (isComplete) redirect("/search");

  const initial: InitialOnboardingState = {
    user_id: user.id,
    email: profile?.email ?? user.email ?? "",
    profile_id: profile?.profile_id ?? null,
    player_type: profile?.player_type ?? null,
    street_address: profile?.street_address ?? null,
    address_line_2: profile?.address_line_2 ?? null,
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    zip_code: profile?.zip_code ?? null,
    full_name:
      profile?.full_name ??
      (typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null),
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black">
      <header className="border-b border-white/5 px-5 py-4 sm:px-8">
        <Logo className="text-2xl" />
      </header>
      <OnboardingFlow initial={initial} />
    </div>
  );
}
