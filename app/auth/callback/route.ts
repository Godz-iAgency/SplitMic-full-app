import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { isAdminEmail } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    const dest = new URL("/login", url.origin);
    dest.searchParams.set("error", errorDescription);
    return NextResponse.redirect(dest);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const dest = new URL("/login", url.origin);
    dest.searchParams.set("error", error.message);
    return NextResponse.redirect(dest);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // Admin accounts skip onboarding and go straight to the admin dashboard.
  if (isAdminEmail(user.email)) {
    return NextResponse.redirect(new URL("/admin", url.origin));
  }

  // The database trigger (handle_new_user) automatically creates the users row.
  // Give it a moment to fire, then check onboarding status.
  const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
  const dest =
    isComplete && profile?.profile_id
      ? `/profile/${profile.profile_id}`
      : "/onboarding";
  return NextResponse.redirect(new URL(dest, url.origin));
}
