import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/supabase/profile";
import { Logo } from "@/components/Logo";
import { SupportForm } from "@/components/support/SupportForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with SplitMic — ask a question, report a bug, or send feedback.",
};

export default async function SupportPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pre-fill from the signed-in user's profile when available; the form works
  // fine for logged-out visitors too.
  let defaultName = "";
  let defaultEmail = user?.email ?? "";
  if (user) {
    const { profile } = await getOnboardingStatus(supabase, user.id);
    defaultName = profile?.full_name ?? "";
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black pb-20">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 shadow-sm shadow-black/40 sm:px-8">
        <Link href={user ? "/search" : "/"}>
          <Logo className="text-2xl" />
        </Link>
        <Link
          href={user ? "/search" : "/"}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Back
        </Link>
      </header>

      <section className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black sm:text-4xl">
            How can we <span className="text-brand-orange">help?</span>
          </h1>
          <p className="mt-3 text-base text-brand-gray-300">
            Questions, bugs, or feedback — send us a message and we&apos;ll get
            back to you by email.
          </p>
        </div>

        <SupportForm defaultName={defaultName} defaultEmail={defaultEmail} />
      </section>
    </main>
  );
}
