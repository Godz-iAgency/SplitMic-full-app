import Link from "next/link";
import Image from "next/image";

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
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black"></div>

      {/* Hero content */}
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <Image
            src="/SplitMic Logo image only.png"
            alt="SplitMic"
            width={120}
            height={120}
            className="h-24 w-24 object-contain drop-shadow-[0_0_30px_rgba(255,107,53,0.5)] sm:h-28 sm:w-28"
            priority
          />
        </div>

        {/* Wordmark */}
        <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
          <span className="text-brand-orange">SPLIT</span>
          <span className="text-white">MIC</span>
        </h1>

        {/* Slogan */}
        <p className="mt-4 text-xl font-bold uppercase tracking-[0.3em] text-brand-orange sm:text-2xl">
          Music Industry Connected
        </p>

        {/* Subheading */}
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-brand-gray-200 sm:text-xl">
          Austin&apos;s music industry on one platform.
          <br className="hidden sm:block" /> Bands, Venues, Talent Buyers,
          Festivals & Record Labels — all in one place.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-xl bg-brand-orange px-10 py-4 text-lg font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:bg-orange-600 hover:shadow-brand-orange/50"
          >
            Get Early Access
          </Link>
          <Link
            href="/login"
            className="rounded-xl border-2 border-white/30 bg-black/40 px-10 py-4 text-lg font-bold text-white backdrop-blur transition hover:border-white hover:bg-white/10"
          >
            Sign In
          </Link>
        </div>

        {/* Privacy reassurance */}
        <p className="mt-6 text-sm text-brand-gray-400">
          Free during beta · No credit card required
        </p>
      </div>
    </section>
  );
}
