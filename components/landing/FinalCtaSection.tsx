import Link from "next/link";
import { Lock } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";

export function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-brand-gray-800 bg-gradient-to-b from-black via-brand-gray-900 to-black px-6 py-20 sm:py-28">
      {/* Subtle orange glow */}
      <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-orange/10 blur-3xl"></div>

      <Reveal className="relative z-10 mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-black sm:text-5xl">
          Join Austin&apos;s{" "}
          <span className="text-brand-orange">music industry network</span>
        </h2>
        <p className="mt-6 text-lg text-brand-gray-200 sm:text-xl">
          Three minutes to a live profile — instead of another month of cold
          DMs and unanswered emails. Free to join, no credit card required.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="group relative overflow-hidden rounded-xl bg-brand-orange px-12 py-5 text-lg font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:bg-orange-600 hover:shadow-brand-orange/50 active:scale-[0.97]"
          >
            <span className="relative z-10">Sign Up Free</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
            />
          </Link>
        </div>

        <p className="mt-6 inline-flex items-center justify-center gap-1.5 text-sm text-brand-gray-400">
          <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Your data is private and never shared.
        </p>
      </Reveal>
    </section>
  );
}
