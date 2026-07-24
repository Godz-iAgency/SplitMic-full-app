import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { isAdminEmail } from "@/lib/supabase/admin";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { EmailSignUpForm } from "@/components/auth/EmailSignUpForm";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (isAdminEmail(user.email)) redirect("/admin");
    const { profile, isComplete } = await getOnboardingStatus(supabase, user.id);
    redirect(
      isComplete && profile?.profile_id
        ? `/profile/${profile.profile_id}`
        : "/onboarding",
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-black via-brand-gray-900 to-black px-6 py-12">
      {/* Back to landing page */}
      <Link
        href="/"
        className="absolute left-5 top-5 flex items-center gap-1.5 text-sm font-semibold text-brand-gray-400 transition hover:text-white sm:left-8 sm:top-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <Logo className="text-4xl sm:text-5xl" />
        </div>

        <div className="card animate-slide-up">
          <div className="text-center">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              Join SplitMic
            </h1>
            <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
              Connect with Austin&apos;s music ecosystem.
            </p>
          </div>

          <div className="mt-6">
            <GoogleSignInButton />
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-wider text-brand-gray-400">
              or sign up with email
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <EmailSignUpForm />

          <p className="mt-6 text-center text-sm text-brand-gray-300">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-brand-orange hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-brand-gray-400">
          By signing up you agree to verify a physical Austin, TX address.
        </p>
      </div>
    </main>
  );
}
