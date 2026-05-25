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

const FEATURES: FeatureDetail[] = [
  {
    id: "find-anyone",
    Icon: Search,
    title: "Find Anyone",
    description:
      "Search by player type, genre, location, or name. Discover who's in the Austin music ecosystem instantly.",
    headline: "The whole scene in one search bar.",
    copy:
      "Need a band that plays loud? A venue near you? Just type what you want and SplitMic finds it. Filter by genre, player type, or name. No more asking around or scrolling Instagram for hours. The whole Austin music world is right here, ready to find.",
  },
  {
    id: "opportunities",
    Icon: Newspaper,
    title: "Community Feed",
    description:
      "See every gig, show, and opportunity Austin is posting — live and in one stream.",
    headline: "Where Austin's music scene posts in real time.",
    copy:
      "Venues post open slots. Festivals list spots. Talent buyers find acts fast. Labels share callouts. Everyone scrolls the same feed. Newest posts float to the top. No phone tag. No lost emails. If you need a show or want to play one, this is where it happens.",
  },
  {
    id: "connections",
    Icon: Users,
    title: "Industry Connections",
    description:
      "Build real relationships with verified industry pros. No fans, no spam — just business.",
    headline: "Real people. Real roles. Real work.",
    copy:
      "Every person on SplitMic is here for music business. Bands. Venues. Bookers. Labels. Festivals. No random fans. No spam accounts. When you connect, you know it counts. One good connection can lead to your next big show or your next signed deal.",
  },
  {
    id: "messaging",
    Icon: MessageCircle,
    title: "Direct Messaging",
    description:
      "Talk to venues, bands, and buyers directly. No more chasing DMs across 5 apps.",
    headline: "One inbox for all your music business.",
    copy:
      "Send a message right to any band, venue, or buyer. No jumping between Instagram, email, and texts. No messages that get lost. Just a clean inbox where real deals get made. Ask the question. Get the answer. Book the show. That simple.",
  },
  {
    id: "profiles",
    Icon: UserCircle,
    title: "Tailored Profiles",
    description:
      "Each player type gets a profile built for what matters in their role.",
    headline: "A profile built for your role.",
    copy:
      "A band's profile is not the same as a venue's profile. That's on purpose. Bands show their sound and set length. Venues show their size and booking info. Each player type fills out what matters for them. Everyone shows up looking sharp and ready.",
  },
  {
    id: "notifications",
    Icon: Bell,
    title: "Real-Time Notifications",
    description:
      "Never miss a connection request, message, or opportunity — get notified the moment it happens.",
    headline: "Hear about it the moment it happens.",
    copy:
      "New message? New gig? New connection request? You'll know right away. SplitMic also sends you an email so you stay in the loop even when the app is closed. Big moves happen fast in music. We make sure you never miss yours.",
  },
];

export function FeaturesSection() {
  const [selected, setSelected] = useState<FeatureDetail | null>(null);

  return (
    <section className="border-t border-brand-gray-800 bg-brand-gray-900/30 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-black sm:text-5xl">
            Everything you need to do{" "}
            <span className="text-brand-orange">business in music</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-gray-300">
            Stop juggling Instagram DMs, group chats, and spreadsheets.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <button
              key={feature.id}
              type="button"
              onClick={() => setSelected(feature)}
              className="group flex flex-col rounded-2xl border border-brand-gray-800 bg-black p-6 text-left transition hover:-translate-y-1 hover:border-brand-orange hover:bg-brand-gray-900 hover:shadow-lg hover:shadow-brand-orange/20 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            >
              <h3 className="text-lg font-bold text-white">{feature.title}</h3>
              <p className="mt-2 flex-1 text-sm text-brand-gray-300">
                {feature.description}
              </p>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-brand-orange opacity-0 transition group-hover:opacity-100">
                Tap to learn more →
              </p>
            </button>
          ))}
        </div>
      </div>

      <FeatureModal detail={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
