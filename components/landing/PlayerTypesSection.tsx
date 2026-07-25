"use client";

import { useState } from "react";
import { PlayerTypeModal, type PlayerTypeDetail } from "./PlayerTypeModal";
import { PLAYER_TYPE_DETAILS } from "./playerTypeDetails";
import { PlayerTypeIcon } from "./PlayerTypeIcon";
import { Reveal } from "@/components/motion/Reveal";

export function PlayerTypesSection() {
  const [selected, setSelected] = useState<PlayerTypeDetail | null>(null);

  return (
    <section
      id="who-its-for"
      className="scroll-mt-20 border-t border-brand-gray-800 bg-black px-6 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-14 text-center">
          <h2 className="text-3xl font-black sm:text-5xl">
            Built for the <span className="text-brand-orange">whole scene</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-gray-300">
            One platform. Five player types. Tap your role to see what you get.
          </p>
        </Reveal>

        {/* Single column on mobile AND tablet (matches the responsive viewer);
            only fans out to 5 across on large desktop. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {PLAYER_TYPE_DETAILS.map((type, i) => (
            <Reveal
              key={type.type}
              delay={Math.min(i, 8) * 0.06}
              className="h-full"
            >
              <button
                type="button"
                onClick={() => setSelected(type)}
                aria-label={`${type.name}: tap to learn more`}
                className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-brand-gray-800 bg-brand-gray-900/50 text-center transition hover:-translate-y-1 hover:border-brand-orange hover:bg-brand-gray-900 hover:shadow-lg hover:shadow-brand-orange/20 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 active:scale-[0.98]"
              >
                {/* Photo on the card face (same image shown in the modal) */}
                <div className="relative aspect-[16/9] w-full overflow-hidden lg:aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={type.image}
                    alt={type.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  {/* Fade the photo into the card body */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-brand-gray-900 via-brand-gray-900/30 to-transparent"
                  />
                  {/* Icon badge floating over the photo */}
                  <div className="absolute bottom-3 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-2xl border border-brand-orange/40 bg-black/70 text-brand-orange shadow-lg shadow-black/40 backdrop-blur transition group-hover:scale-110">
                    <PlayerTypeIcon
                      type={type.type}
                      className="h-6 w-6"
                      strokeWidth={1.75}
                    />
                  </div>
                </div>

                {/* Text body */}
                <div className="flex flex-1 flex-col p-6 pt-5">
                  <h3 className="text-xl font-bold text-white">{type.name}</h3>
                  <p className="mt-2 flex-1 text-sm text-brand-gray-300">
                    {type.headline}
                  </p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-brand-orange opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
                    Tap to learn more →
                  </p>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      <PlayerTypeModal detail={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
