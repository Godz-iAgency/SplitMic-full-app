import Link from "next/link";
import Image from "next/image";

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden bg-black px-6 py-12 sm:py-20"
    >
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
        {/* Logo — scales in, then floats gently, with a CSS glow pulse behind it */}
        <div className="mb-4 flex justify-center animate-hero-scale sm:mb-6">
          <div className="relative animate-float">
            {/* Pulsing orange glow (pure CSS — no JS) */}
            <div className="absolute inset-0 rounded-full bg-brand-orange/30 blur-2xl animate-glow-pulse" />
            <Image
              src="/SplitMic Logo image only.png"
              alt="SplitMic"
              width={120}
              height={120}
              className="relative h-20 w-20 object-contain drop-shadow-[0_0_30px_rgba(255,107,53,0.5)] sm:h-28 sm:w-28"
              priority
            />
          </div>
        </div>

        {/* Wordmark */}
        <h1
          className="text-4xl font-black tracking-tight animate-hero-rise sm:text-7xl"
          style={{ animationDelay: "0.15s" }}
        >
          <span className="text-brand-orange">SPLIT</span>
          <span className="text-white">MIC</span>
        </h1>

        {/* Slogan */}
        <p
          className="mt-3 text-base font-bold uppercase tracking-[0.25em] text-brand-orange animate-hero-rise sm:mt-4 sm:text-2xl sm:tracking-[0.3em]"
          style={{ animationDelay: "0.27s" }}
        >
          Music Industry Connected
        </p>

        {/* Subheading */}
        <p
          className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-brand-gray-200 animate-hero-rise sm:mt-8 sm:text-xl"
          style={{ animationDelay: "0.39s" }}
        >
          Austin&apos;s music industry on one platform.
          <br className="hidden sm:block" /> Bands, Venues, Talent Buyers,
          Record Labels & Festivals, all in one place.
        </p>

        {/* CTAs */}
        <div
          className="mt-7 flex flex-col items-center justify-center gap-3 animate-hero-rise sm:mt-10 sm:flex-row sm:gap-4"
          style={{ animationDelay: "0.51s" }}
        >
          <Link
            href="/signup"
            className="group relative w-full overflow-hidden rounded-xl bg-brand-orange px-10 py-3.5 text-lg font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:bg-orange-600 hover:shadow-brand-orange/50 active:scale-[0.97] sm:w-auto sm:py-4"
          >
            <span className="relative z-10">Sign Up Free</span>
            {/* Periodic light sweep to draw the eye to signup */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
            />
          </Link>
          <Link
            href="/login"
            className="w-full rounded-xl border-2 border-white/30 bg-black/40 px-10 py-3.5 text-lg font-bold text-white backdrop-blur transition hover:border-white hover:bg-white/10 active:scale-[0.97] sm:w-auto sm:py-4"
          >
            Log In
          </Link>
        </div>

        {/* Privacy reassurance */}
        <p
          className="mt-5 text-sm text-brand-gray-400 animate-hero-rise sm:mt-6"
          style={{ animationDelay: "0.63s" }}
        >
          Free to join · No credit card required
        </p>
      </div>
    </section>
  );
}
