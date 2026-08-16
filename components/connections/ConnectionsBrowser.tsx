"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { PLAYER_TYPE_OPTIONS, type PlayerType } from "@/lib/types";
import { ConnectionCard } from "./ConnectionCard";
import type { Connection } from "@/lib/supabase/messaging";

type Filter = PlayerType | "all";

/**
 * Client-side browser for the connections list: name search + player-type
 * filter pills. Filtering is purely in-memory — the full list is small (it's
 * just the people you've connected with) so there's no need to round-trip.
 */
export function ConnectionsBrowser({
  connections,
}: {
  connections: Connection[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Only show type pills for types the user actually has connections with.
  const presentTypes = useMemo(() => {
    const set = new Set(connections.map((c) => c.player_type));
    return PLAYER_TYPE_OPTIONS.filter((o) => set.has(o.value));
  }, [connections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return connections.filter((c) => {
      if (filter !== "all" && c.player_type !== filter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [connections, query, filter]);

  return (
    <div>
      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400"
          strokeWidth={2}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search connections…"
          aria-label="Search connections by name"
          className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-brand-gray-400 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
        />
      </div>

      {/* Type filter pills — only when there's more than one type to filter */}
      {presentTypes.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterPill
            label="All"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          {presentTypes.map((o) => (
            <FilterPill
              key={o.value}
              label={o.label}
              active={filter === o.value}
              onClick={() => setFilter(o.value)}
            />
          ))}
        </div>
      ) : null}

      {/* List */}
      <div className="mt-6">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/5 p-10 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
              <Users className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-white">
              No matches
            </h2>
            <p className="mt-2 text-sm text-brand-gray-300">
              Try a different name or clear the filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filtered.map((c) => (
              <ConnectionCard key={c.thread_id} connection={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full bg-brand-orange px-4 py-1.5 text-sm font-semibold text-black"
          : "rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-semibold text-brand-gray-300 tappable hover:bg-white/10 hover:text-white"
      }
    >
      {label}
    </button>
  );
}
