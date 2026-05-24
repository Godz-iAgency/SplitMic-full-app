import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black via-brand-gray-900 to-black px-6 py-12">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <Logo className="text-4xl sm:text-5xl" />
        </div>

        <div className="card animate-slide-up">
          <div className="text-center">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              Set a new password
            </h1>
            <p className="mt-2 text-sm text-brand-gray-300">
              Choose a strong password you&apos;ll remember.
            </p>
          </div>

          <div className="mt-6">
            <ResetPasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}
