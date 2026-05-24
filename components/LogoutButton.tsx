"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
      className="btn-secondary"
    >
      {loading ? "Signing out…" : "Logout"}
    </button>
  );
}
