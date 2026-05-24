import { Logo } from "@/components/Logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-brand-gray-800 bg-black px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Logo className="text-2xl" />
          <p className="text-xs uppercase tracking-[0.25em] text-brand-orange">
            Music Industry Connected
          </p>
        </div>

        <p className="text-sm text-brand-gray-400">
          © {new Date().getFullYear()} SplitMic. Built for Austin&apos;s music scene.
        </p>
      </div>
    </footer>
  );
}
