"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { searchBandsForTaggingAction } from "@/app/opportunities/actions";
import { MAX_TAGGED_BANDS_PER_EVENT } from "@/lib/supabase/marketplace";

type Band = { profile_id: string; band_name: string; avatar_url: string | null };

type Props = {
  selected: Band[];
  onChange: (next: Band[]) => void;
};

export function BandTagPicker({ selected, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Band[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const lastQuery = useRef("");

  useEffect(() => {
    const q = query.trim();
    if (q === lastQuery.current) return;
    if (q.length < 2) {
      setResults([]);
      lastQuery.current = q;
      return;
    }
    const t = setTimeout(() => {
      lastQuery.current = q;
      startTransition(async () => {
        const data = await searchBandsForTaggingAction(q);
        setResults(data);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function addBand(b: Band) {
    if (selected.length >= MAX_TAGGED_BANDS_PER_EVENT) return;
    if (selected.some((s) => s.profile_id === b.profile_id)) return;
    onChange([...selected, b]);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function removeBand(id: string) {
    onChange(selected.filter((s) => s.profile_id !== id));
  }

  const atLimit = selected.length >= MAX_TAGGED_BANDS_PER_EVENT;

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-white">
        Tag bands performing
        <span className="ml-2 text-xs font-normal text-brand-gray-400">
          ({selected.length}/{MAX_TAGGED_BANDS_PER_EVENT})
        </span>
      </label>

      {/* Selected chips */}
      {selected.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((b) => (
            <span
              key={b.profile_id}
              className="inline-flex items-center gap-2 rounded-full bg-brand-orange/20 px-3 py-1 text-xs font-semibold text-brand-orange"
            >
              {b.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.avatar_url}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : null}
              {b.band_name}
              <button
                type="button"
                onClick={() => removeBand(b.profile_id)}
                className="ml-1 inline-flex h-4 w-4 items-center justify-center text-brand-orange hover:text-white"
                aria-label={`Remove ${b.band_name}`}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* Search input */}
      {!atLimit ? (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search a band by name…"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-brand-gray-500 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40"
          />

          {open && results.length > 0 ? (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-brand-gray-900 shadow-xl">
              {results.map((b) => {
                const alreadySelected = selected.some(
                  (s) => s.profile_id === b.profile_id,
                );
                return (
                  <button
                    type="button"
                    key={b.profile_id}
                    onClick={() => addBand(b)}
                    disabled={alreadySelected}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {b.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.avatar_url}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gray-800 text-[10px] font-bold text-brand-orange">
                        {b.band_name.charAt(0)}
                      </div>
                    )}
                    <span className="flex-1 text-white">{b.band_name}</span>
                    {alreadySelected ? (
                      <span className="text-xs text-brand-gray-400">added</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {open && query.trim().length >= 2 && results.length === 0 ? (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-white/10 bg-brand-gray-900 px-4 py-3 text-xs text-brand-gray-400 shadow-xl">
              No published bands found.
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-brand-gray-400">
          Maximum {MAX_TAGGED_BANDS_PER_EVENT} bands per event.
        </p>
      )}

      <p className="mt-2 text-xs text-brand-gray-400">
        Tagged bands get notified and can accept the tag to show this event on
        their profile.
      </p>
    </div>
  );
}
