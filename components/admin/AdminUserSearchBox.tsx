"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * Search-by-name box for admin list pages. Posts back to whatever admin route
 * it's rendered on (users, directory), preserving the other filter params.
 */
export function AdminUserSearchBox({
  placeholder = "Search by name or email...",
}: {
  placeholder?: string;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    if (value.trim()) params.set("q", value.trim());
    else params.delete("q");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-full bg-brand-orange px-5 py-2 text-sm font-semibold text-black transition hover:bg-brand-orange/90"
      >
        Search
      </button>
    </form>
  );
}
