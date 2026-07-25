"use client";

import { useState } from "react";
import {
  Search,
  Newspaper,
  Users,
  MessageCircle,
  UserCircle,
  Bell,
} from "lucide-react";
import { FeatureModal, type FeatureDetail } from "./FeatureModal";
import { Reveal } from "@/components/motion/Reveal";

const FEATURES: FeatureDetail[] = [
  {
    id: "find-anyone",
    Icon: Search,
    title: "Find Anyone",
    description:
      "Search by player type, genre, location, or name. Discover who's in the Austin music ecosystem instantly.",
    headline: "The whole scene in one search bar.",
    copy:
      "Type what you're after (band, venue, or buyer) and filter by genre, player type, or name. No more asking around.",
  },
  {
    id: "opportunities",
    Icon: Newspaper,
    title: "Community Feed",
    description:
      "See every gig, show, and opportunity Austin is posting, live and in one stream.",
    headline: "Where Austin's music scene posts in real time.",
    copy:
      "Venues post slots, festivals list spots, bands find shows, all in one live feed, newest first. No phone tag, no lost emails.",
  },
  {
    id: "connections",
    Icon: Users,
    title: "Industry Connections",
    description:
      "Build real relationships with verified industry pros. No fans, no spam. Just business.",
    headline: "Real people. Real roles. Real work.",
    copy:
      "Everyone here is in music business: bands, venues, bookers, labels, festivals. No random fans, no spam. Every connection counts.",
  },
  {
    id: "messaging",
    Icon: MessageCircle,
    title: "Direct Messaging",
    description:
      "Talk to venues, bands, and buyers directly. No more chasing DMs across 5 apps.",
    headline: "One inbox for all your music business.",
    copy:
      "Message any band, venue, or buyer directly, without jumping between Instagram, email, and texts. Ask, get an answer, book the show.",
  },
  {
    id: "profiles",
    Icon: UserCircle,
    title: "Tailored Profiles",
    description:
      "Each player type gets a profile built for what matters in their role.",
    headline: "A profile built for your role.",
    copy:
      "Bands show their sound and set length, venues show size and booking info. Each player type fills out what actually matters.",
  },
  {
    id: "notifications",
    Icon: Bell,
    title: "Real-Time Notifications",
    description:
      "Never miss a connection request, message, or opportunity. Get notified the moment it happens.",
    headline: "Hear about it the moment it happens.",
    copy:
      "New message, gig, or connection request: you'll know right away, with email backup so you stay in the loop even when the app is closed.",
  },
];

export function FeaturesSection() {
  const [selected, setSelected] = useState<FeatureDetail | null>(null);

  return (
    <section
      id="features"
      className="scroll-mt-20 border-t border-brand-gray-800 bg-brand-gray-900/30 px-6 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-14 text-center">
          <h2 className="text-3xl font-black sm:text-5xl">
            Everything you need to do{" "}
            <span className="text-brand-orange">business in music</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-gray-300">
            Stop juggling Instagram DMs, group chats, and spreadsheets.
          </p>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.id} delay={Math.min(i, 8) * 0.06} className="h-full">
              <button
                type="button"
                onClick={() => setSelected(feature)}
                className="group flex h-full w-full flex-col rounded-2xl border border-brand-gray-800 bg-black p-6 text-left transition hover:-translate-y-1 hover:border-brand-orange hover:bg-brand-gray-900 hover:shadow-lg hover:shadow-brand-orange/20 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
              >
                {/* Same icon as the modal header — orange rounded square */}
                <div className="mb-4 inline-flex h-12 w-12 shrink-0 items-center justify-center self-start rounded-2xl border border-brand-orange/40 bg-brand-orange/10 text-brand-orange shadow-md shadow-brand-orange/20 transition group-hover:scale-110">
                  <feature.Icon
                    className="h-6 w-6"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                <p className="mt-2 flex-1 text-sm text-brand-gray-300">
                  {feature.description}
                </p>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-brand-orange opacity-0 transition group-hover:opacity-100">
                  Tap to learn more →
                </p>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      <FeatureModal detail={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
