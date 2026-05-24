import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { isAdminEmail } from "@/lib/supabase/admin";
import { LandingPage } from "@/components/landing/LandingPage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-in users → app
  if (user) {
    if (isAdminEmail(user.email)) redirect("/admin");
    const { isComplete } = await getOnboardingStatus(supabase, user.id);
    redirect(isComplete ? "/search" : "/onboarding");
  }

  // Everyone else → landing page
  return <LandingPage />;
}
