"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClientSupabaseClient } from "@/lib/supabase/client";

export function LogoutButton() {
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
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-brand-gray-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      <span className="hidden sm:inline">
        {loading ? "Signing out…" : "Logout"}
      </span>
    </button>
  );
}
