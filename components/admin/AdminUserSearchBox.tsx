"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function AdminUserSearchBox() {
  const router = useRouter();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    if (value.trim()) params.set("q", value.trim());
    else params.delete("q");
    router.push(`/admin/users?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name or email..."
        className="flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange focus:outline-none"
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
