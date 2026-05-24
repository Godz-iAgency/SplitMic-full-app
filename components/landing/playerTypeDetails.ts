import type { PlayerTypeDetail } from "./PlayerTypeModal";

export const PLAYER_TYPE_DETAILS: PlayerTypeDetail[] = [
  {
    type: "band",
    emoji: "🎸",
    name: "Bands",
    headline: "Stop chasing gigs. Start landing them.",
    copy:
      "SplitMic gives your band a professional home in Austin's music industry. Get discovered by venues, talent buyers, festivals, and labels — all actively looking for acts like yours. No more cold DMs. No more lost emails. Just real opportunities, in one place.",
    benefits: [
      "A profile built specifically for bands — genres, set length, members, sound",
      "Direct access to venues and talent buyers booking shows right now",
      "An opportunities marketplace where gigs come to you",
      "Verified industry connections — not random fans",
    ],
  },
  {
    type: "venue",
    emoji: "🏛️",
    name: "Venues",
    headline: "Fill your calendar with the right acts.",
    copy:
      "Stop sifting through hundreds of cold pitches. SplitMic puts you in front of Austin's most active bands and helps you discover talent that fits your room, your crowd, and your vibe. Post what you're looking for and let the right artists come to you.",
    benefits: [
      "Search bands by genre, sound, set length, and Instagram following",
      "Post opportunities and get matched with the right acts",
      "Manage bookings without endless email threads",
      "Build a roster of artists your audience will love",
    ],
  },
  {
    type: "talent_buyer",
    emoji: "🎤",
    name: "Talent Buyers",
    headline: "Source talent without the grind.",
    copy:
      "Whether you're booking a single show or curating a season, SplitMic is the fastest way to find, vet, and book Austin artists. Filter by genre, sound, and fit — then message bands directly. No middlemen, no missed opportunities, no wasted time.",
    benefits: [
      "Direct contact with verified Austin bands",
      "Filter by genre, member count, set length, and more",
      "Post calls for talent and get instant responses",
      "Build your roster faster than ever",
    ],
  },
  {
    type: "festival",
    emoji: "🎪",
    name: "Festivals",
    headline: "Curate lineups that sell tickets.",
    copy:
      "Building a festival lineup shouldn't take 6 months of cold outreach. SplitMic lets you discover Austin's hottest acts in minutes, post your festival to the marketplace, and get applications from bands actively looking to play. Lineup season just got way easier.",
    benefits: [
      "Discover emerging Austin acts before anyone else",
      "Post festival slots and get band applications",
      "Filter applicants by genre, draw, and experience",
      "Manage your entire booking pipeline in one place",
    ],
  },
  {
    type: "record_label",
    emoji: "💿",
    name: "Record Labels",
    headline: "Scout the Austin scene from your laptop.",
    copy:
      "Austin is one of the most talent-dense music cities in the world. SplitMic gives labels direct access to unsigned bands actively building their careers here. Track their Instagram followings, hear their sound, see who's booking them — all before you even reach out.",
    benefits: [
      "Filter unsigned bands by genre, traction, and growth",
      "See which venues and festivals are already booking them",
      "Direct messaging — no manager middlemen",
      "Stay ahead of the next Austin breakout act",
    ],
  },
];
