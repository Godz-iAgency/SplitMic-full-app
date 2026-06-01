import type { PlayerTypeDetail } from "./PlayerTypeModal";

export const PLAYER_TYPE_DETAILS: PlayerTypeDetail[] = [
  {
    type: "band",
    name: "Bands",
    headline: "Stop chasing gigs. Start landing them.",
    image: "/players/band.jpg",
    benefits: [
      "A profile built for bands — genres, set length, sound",
      "Direct access to venues and talent buyers booking now",
      "An opportunities marketplace where gigs come to you",
    ],
  },
  {
    type: "venue",
    name: "Venues",
    headline: "Fill your calendar with the right acts.",
    image: "/players/venue.jpg",
    benefits: [
      "Search bands by genre, sound, set length, and following",
      "Post openings and get matched with the right acts",
      "Manage bookings without endless email threads",
    ],
  },
  {
    type: "talent_buyer",
    name: "Talent Buyers",
    headline: "Source talent without the grind.",
    image: "/players/talent_buyer.jpg",
    benefits: [
      "Direct contact with verified Austin bands",
      "Filter by genre, member count, set length, and more",
      "Post calls for talent and get instant responses",
    ],
  },
  {
    type: "festival",
    name: "Festivals",
    headline: "Curate lineups that sell tickets.",
    image: "/players/festival.jpg",
    benefits: [
      "Discover emerging Austin acts before anyone else",
      "Post festival slots and get band applications",
      "Filter applicants by genre, draw, and experience",
    ],
  },
  {
    type: "record_label",
    name: "Record Labels",
    headline: "Scout the Austin scene from your laptop.",
    image: "/players/record_label.jpg",
    benefits: [
      "Filter unsigned bands by genre, traction, and growth",
      "See which venues and festivals are booking them",
      "Direct messaging — no manager middlemen",
    ],
  },
];
