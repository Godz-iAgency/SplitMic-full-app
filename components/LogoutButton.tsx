"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClientSupabaseClient } from "@/lib/supabase/client";

type Props = {
  /** Smaller on mobile, icon hidden below sm: — for the profile page's owner-
   *  actions row, where it sits alongside two other pills and needs to fit
   *  on one line rather than wrap. Full size everywhere else (unaffected). */
  compact?: boolean;
};

export function LogoutButton({ compact = false }: Props = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClientSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label="Sign out"
      className={
        compact
          ? "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold text-brand-gray-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
          : "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-brand-gray-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <LogOut
        className={compact ? "hidden h-4 w-4 sm:inline-block" : "h-4 w-4"}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span>{loading ? "Signing out…" : "Logout"}</span>
    </button>
  );
}
