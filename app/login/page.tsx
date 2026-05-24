import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { isAdminEmail } from "@/lib/supabase/admin";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { EmailSignInForm } from "@/components/auth/EmailSignInForm";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (isAdminEmail(user.email)) redirect("/admin");
    const { isComplete } = await getOnboardingStatus(supabase, user.id);
    redirect(isComplete ? "/search" : "/onboarding");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black via-brand-gray-900 to-black px-6 py-12">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <Logo className="text-4xl sm:text-5xl" />
        </div>

        <div className="card animate-slide-up">
          <div className="text-center">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-brand-gray-300 sm:text-base">
              Sign in to your SplitMic account.
            </p>
          </div>

          <div className="mt-6">
            <GoogleSignInButton />
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-wider text-brand-gray-400">
              or
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <EmailSignInForm />

          <p className="mt-6 text-center text-sm text-brand-gray-300">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-brand-orange hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-brand-gray-400">
          By continuing you agree to verify a physical Austin, TX address.
        </p>
      </div>
    </main>
  );
}
