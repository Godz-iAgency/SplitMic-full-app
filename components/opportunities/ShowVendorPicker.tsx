"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Search } from "lucide-react";
import {
  addVendorToShow,
  searchVendorsForShowAction,
} from "@/app/opportunities/actions";
import {
  PLAYER_TYPE_OPTIONS,
  VENDOR_PLAYER_TYPES,
  type VendorPlayerType,
} from "@/lib/types";
import type { SearchCard } from "@/lib/supabase/search";
import { PlayerTypeIcon } from "@/components/landing/PlayerTypeIcon";

type Filter = VendorPlayerType | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  ...VENDOR_PLAYER_TYPES.map((t) => ({
    value: t,
    label: PLAYER_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t,
  })),
];

type Props = {
  postId: string;
  /** Businesses already on this show (any status), shown as "Added". */
  listedIds: string[];
  /** How many more this show can take before hitting the cap. */
  remaining: number;
};

/**
 * The show owner's "Add gear & services": search the SplitMic members who are
 * backline, rental, or rehearsal businesses and ask them onto this show. Adding
 * only sends the ask; they appear publicly once they accept.
 */
export function ShowVendorPicker({ postId, listedIds, remaining }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [results, setResults] = useState<SearchCard[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(() => new Set(listedIds));
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [, startAdd] = useTransition();
  // Drops responses that arrive after a newer search started, so typing fast
  // never leaves an older result list on screen.
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const seq = ++searchSeq.current;
      startSearch(async () => {
        const cards = await searchVendorsForShowAction(query.trim(), filter);
        if (seq === searchSeq.current) setResults(cards);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [open, query, filter]);

  function add(card: SearchCard) {
    setError(null);
    setAddingId(card.profile_id);
    startAdd(async () => {
      const result = await addVendorToShow(postId, card.profile_id);
      setAddingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAdded((prev) => new Set(prev).add(card.profile_id));
      router.refresh();
    });
  }

  const full = remaining <= 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={full}
        className="tappable inline-flex min-h-[44px] items-center gap-2 rounded-full border border-brand-orange/40 bg-brand-orange/10 px-5 text-sm font-bold text-brand-orange hover:bg-brand-orange hover:text-black disabled:opacity-50"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        Add gear &amp; services
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Type of business">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={`tappable min-h-[36px] rounded-full border px-3 text-xs font-semibold ${
              filter === f.value
                ? "border-brand-orange bg-brand-orange text-black"
                : "border-white/15 bg-white/5 text-brand-gray-300 hover:border-white/40 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <label className="relative mt-3 block">
        <span className="sr-only">Search by business name</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by business name"
          maxLength={80}
          className="input-field w-full pl-9"
        />
      </label>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto" aria-busy={isSearching}>
        {results === null ? (
          <li className="py-4 text-center text-xs text-brand-gray-400">Searching…</li>
        ) : results.length === 0 ? (
          <li className="py-4 text-center text-xs text-brand-gray-400">
            No gear or rehearsal businesses on SplitMic match that yet.
          </li>
        ) : (
          results.map((card) => {
            const isAdded = added.has(card.profile_id);
            const label =
              PLAYER_TYPE_OPTIONS.find((o) => o.value === card.player_type)?.label ??
              card.player_type;
            return (
              <li
                key={card.profile_id}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[.03] p-2.5"
              >
                {card.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.avatar_url}
                    alt=""
                    className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
                    <PlayerTypeIcon type={card.player_type} className="h-5 w-5" strokeWidth={2} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">
                    {card.display_name}
                  </span>
                  <span className="block truncate text-xs text-brand-gray-400">
                    {label}
                    {card.one_liner ? ` · ${card.one_liner}` : ""}
                  </span>
                </span>
                {isAdded ? (
                  <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-emerald-300">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                    Added
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => add(card)}
                    disabled={addingId !== null || full}
                    className="tappable min-h-[36px] flex-shrink-0 rounded-full bg-brand-orange px-4 text-xs font-bold text-black hover:bg-brand-orange/90 disabled:opacity-50"
                  >
                    {addingId === card.profile_id ? "Adding…" : "Add"}
                  </button>
                )}
              </li>
            );
          })
        )}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-brand-gray-400">
          They&apos;re asked first, and only show up here once they accept.
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="tappable flex-shrink-0 text-xs font-semibold text-brand-gray-300 hover:text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}
