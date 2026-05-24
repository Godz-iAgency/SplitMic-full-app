import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black via-brand-gray-900 to-black px-6 py-12">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <Logo className="text-4xl sm:text-5xl" />
        </div>

        <div className="card animate-slide-up">
          <div className="text-center">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              Forgot password?
            </h1>
            <p className="mt-2 text-sm text-brand-gray-300">
              We&apos;ll send a reset link to your email.
            </p>
          </div>

          <div className="mt-6">
            <ForgotPasswordForm />
          </div>

          <p className="mt-6 text-center text-sm text-brand-gray-300">
            Remember your password?{" "}
            <Link
              href="/login"
              className="font-semibold text-brand-orange hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
