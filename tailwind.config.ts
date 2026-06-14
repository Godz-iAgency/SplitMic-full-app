import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
      },
    },
  },
  plugins: [],
};

export default config;
