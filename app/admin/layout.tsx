import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/supabase/admin";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/search");

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-brand-gray-900 to-black">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 shadow-sm shadow-black/40 bg-black/40 px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/admin" className="shrink-0">
            <Logo className="text-lg sm:text-2xl" />
          </Link>
          <span className="shrink-0 rounded-full bg-brand-orange/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-orange sm:px-3 sm:text-xs">
            Admin
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link
            href="/search"
            aria-label="Back to app"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 sm:px-4"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">Back to app</span>
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-5 py-6 sm:px-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <AdminNav />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-4 lg:hidden">
            <AdminNav />
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
