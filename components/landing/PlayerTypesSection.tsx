"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { PlayerTypeModal, type PlayerTypeDetail } from "./PlayerTypeModal";
import { PLAYER_TYPE_DETAILS } from "./playerTypeDetails";
import { PlayerTypeIcon } from "./PlayerTypeIcon";
import { Reveal } from "@/components/motion/Reveal";

export function PlayerTypesSection() {
  const [flipped, setFlipped] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlayerTypeDetail | null>(null);

  return (
    <section
      id="who-its-for"
      className="border-t border-brand-gray-800 bg-black px-6 py-20 sm:py-24"
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

        {/* Phase 4 — mobile: horizontal snap scroll. sm+: 2-col grid. lg+: 5-col grid. */}
        <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2 [scroll-snap-type:x_mandatory] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 sm:[scroll-snap-type:none] lg:grid-cols-5">
          {PLAYER_TYPE_DETAILS.map((type, i) => (
            <Reveal
              key={type.type}
              delay={Math.min(i, 8) * 0.06}
              className="w-64 flex-shrink-0 [scroll-snap-align:start] sm:w-auto sm:flex-shrink"
            >
              {/* Phase 3 — 3D flip card */}
              <div style={{ perspective: "1000px" }}>
                <motion.div
                  className="relative w-full [transform-style:preserve-3d]"
                  animate={{ rotateY: flipped === type.type ? 180 : 0 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Front face — in flow, defines card height */}
                  <div
                    className="flex min-h-[230px] cursor-pointer flex-col rounded-2xl border border-brand-gray-800 bg-brand-gray-900/50 p-5 text-center [backface-visibility:hidden] transition hover:border-brand-orange hover:bg-brand-gray-900 hover:shadow-lg hover:shadow-brand-orange/20"
                    onClick={() => setFlipped(type.type)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setFlipped(type.type)}
                    aria-label={`Flip card to see ${type.name} benefits`}
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
                    <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-brand-orange">
                      Tap to see benefits →
                    </p>
                  </div>

                  {/* Back face — absolutely overlays front, pre-rotated 180° */}
                  <div className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-brand-orange bg-brand-gray-900 p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    {/* Close button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFlipped(null);
                      }}
                      className="absolute right-3 top-3 rounded-full p-1.5 text-brand-gray-400 transition hover:text-white"
                      aria-label="Flip back"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <h3 className="pr-6 text-sm font-bold text-brand-orange">
                      {type.name}
                    </h3>

                    <ul className="mt-3 flex flex-1 flex-col gap-2.5 overflow-y-auto">
                      {type.benefits.map((benefit) => (
                        <li
                          key={benefit}
                          className="flex items-start gap-2 text-xs text-brand-gray-200"
                        >
                          <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-orange" />
                          {benefit}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(type);
                        setFlipped(null);
                      }}
                      className="mt-4 rounded-lg bg-brand-orange/10 px-3 py-2 text-xs font-bold text-brand-orange transition hover:bg-brand-orange hover:text-white"
                    >
                      Full details →
                    </button>
                  </div>
                </motion.div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Swipe hint — only visible on mobile */}
        <p className="mt-3 text-center text-xs text-brand-gray-500 sm:hidden">
          ← Swipe to see all roles →
        </p>
      </div>

      <PlayerTypeModal detail={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
