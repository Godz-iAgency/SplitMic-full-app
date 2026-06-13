"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

function fadeUp(delay: number, y = 20) {
  return {
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.65, delay, ease },
  };
}

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 py-20">
      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover opacity-40"
        aria-hidden="true"
      >
        <source src="/splitmic-intro.mp4" type="video/mp4" />
      </video>

      {/* Dark gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />

      {/* Hero content */}
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Logo — scales in with glow pulse */}
        <motion.div
          className="mb-6 flex justify-center"
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.75, ease }}
        >
          <div className="relative">
            {/* Pulsing orange glow behind logo */}
            <motion.div
              className="absolute inset-0 rounded-full bg-brand-orange/30 blur-2xl"
              animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.85, 1.25, 0.85] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <Image
              src="/SplitMic Logo image only.png"
              alt="SplitMic"
              width={120}
              height={120}
              className="relative h-24 w-24 object-contain drop-shadow-[0_0_30px_rgba(255,107,53,0.5)] sm:h-28 sm:w-28"
              priority
            />
          </div>
        </motion.div>

        {/* Wordmark */}
        <motion.h1
          className="text-5xl font-black tracking-tight sm:text-7xl"
          {...fadeUp(0.18)}
        >
          <span className="text-brand-orange">SPLIT</span>
          <span className="text-white">MIC</span>
        </motion.h1>

        {/* Slogan */}
        <motion.p
          className="mt-4 text-xl font-bold uppercase tracking-[0.3em] text-brand-orange sm:text-2xl"
          {...fadeUp(0.30)}
        >
          Music Industry Connected
        </motion.p>

        {/* Subheading */}
        <motion.p
          className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-brand-gray-200 sm:text-xl"
          {...fadeUp(0.42)}
        >
          Austin&apos;s music industry on one platform.
          <br className="hidden sm:block" /> Bands, Venues, Talent Buyers,
          Festivals & Record Labels — all in one place.
        </motion.p>

        {/* CTAs — Phase 5: whileTap spring feedback */}
        <motion.div
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          {...fadeUp(0.55, 12)}
        >
          <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
            <Link
              href="/signup"
              className="rounded-xl bg-brand-orange px-10 py-4 text-lg font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:bg-orange-600 hover:shadow-brand-orange/50"
            >
              Get Early Access
            </Link>
          </motion.div>
          <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
            <Link
              href="/login"
              className="rounded-xl border-2 border-white/30 bg-black/40 px-10 py-4 text-lg font-bold text-white backdrop-blur transition hover:border-white hover:bg-white/10"
            >
              Sign In
            </Link>
          </motion.div>
        </motion.div>

        {/* Privacy reassurance */}
        <motion.p
          className="mt-6 text-sm text-brand-gray-400"
          {...fadeUp(0.68, 8)}
        >
          Free during beta · No credit card required
        </motion.p>
      </div>
    </section>
  );
}
