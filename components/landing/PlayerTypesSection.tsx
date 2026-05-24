"use client";

import { useState } from "react";
import { PlayerTypeModal, type PlayerTypeDetail } from "./PlayerTypeModal";
import { PLAYER_TYPE_DETAILS } from "./playerTypeDetails";
import { PlayerTypeIcon } from "./PlayerTypeIcon";

export function PlayerTypesSection() {
  const [selected, setSelected] = useState<PlayerTypeDetail | null>(null);

  return (
    <section
      id="who-its-for"
      className="border-t border-brand-gray-800 bg-black px-6 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-black sm:text-5xl">
            Built for the <span className="text-brand-orange">whole scene</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-gray-300">
            One platform. Five player types. Click your role to see how SplitMic
            works for you.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {PLAYER_TYPE_DETAILS.map((type) => (
            <button
              key={type.type}
              type="button"
              onClick={() => setSelected(type)}
              className="group flex flex-col rounded-2xl border border-brand-gray-800 bg-brand-gray-900/50 p-6 text-center transition hover:-translate-y-1 hover:border-brand-orange hover:bg-brand-gray-900 hover:shadow-lg hover:shadow-brand-orange/20 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            >
              <div className="mb-4 flex justify-center text-brand-orange transition group-hover:scale-110">
                <PlayerTypeIcon
                  type={type.type}
                  className="h-12 w-12"
                  strokeWidth={1.5}
                />
              </div>
              <h3 className="text-xl font-bold text-white">{type.name}</h3>
              <p className="mt-2 flex-1 text-sm text-brand-gray-300">
                {type.headline}
              </p>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-brand-orange opacity-0 transition group-hover:opacity-100">
                Tap to learn more →
              </p>
            </button>
          ))}
        </div>
      </div>

      <PlayerTypeModal detail={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
