import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Font scale bumped one step up for dark-mode legibility (white-on-dark
      // reads smaller than dark-on-white at the same px, so the app needs to
      // run larger than a light-mode UI like LinkedIn to feel equally crisp).
      // ONLY font-size + line-height change here — spacing/padding/gap use the
      // separate `spacing` scale and are untouched, so layouts don't shift.
      // Page titles (`2xl`+) are intentionally left at Tailwind defaults.
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.25rem" }], // 14px (was 12)
        sm: ["1rem", { lineHeight: "1.5rem" }], // 16px (was 14)
        base: ["1.125rem", { lineHeight: "1.75rem" }], // 18px (was 16)
        lg: ["1.25rem", { lineHeight: "1.875rem" }], // 20px (was 18)
        xl: ["1.375rem", { lineHeight: "1.875rem" }], // 22px (was 20)
      },
      colors: {
        brand: {
          orange: "#FF6B35",
          "orange-dark": "#E5562A",
          "orange-light": "#FF8757",
          black: "#000000",
          "gray-900": "#1a1a1a",
          "gray-800": "#2d2d2d",
          "gray-400": "#999999",
          "gray-300": "#cccccc",
          "gray-200": "#e5e5e5",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "DM Sans",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        // Hero entrance — CSS-driven so it plays on first paint without waiting
        // for JS hydration. `both` fill-mode holds the final (visible) state.
        "hero-rise": "heroRise 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "hero-scale": "heroScale 0.7s cubic-bezier(0.22,1,0.36,1) both",
        "glow-pulse": "glowPulse 3.2s ease-in-out infinite",
        // Continuous ambient motion after the entrance settles.
        float: "float 4s ease-in-out infinite",
        // Periodic light sweep — draws the eye to the primary CTA.
        shimmer: "shimmer 3s ease-in-out infinite",
        // Continuous shine riding on top of the onboarding "Creating account"
        // progress bar, whose width itself tracks real save progress rather
        // than a fixed duration — distinct from the slower CTA `shimmer` above.
        "bar-shimmer": "barShimmer 1.4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        heroRise: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        heroScale: {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.35", transform: "scale(0.85)" },
          "50%": { opacity: "0.7", transform: "scale(1.2)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "60%, 100%": { transform: "translateX(100%)" },
        },
        barShimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
