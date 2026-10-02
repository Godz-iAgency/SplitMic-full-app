import type { PlayerTypeDetail } from "./PlayerTypeModal";

// The five roles with a profile builder and a signup mini-quiz. The gear and
// space businesses are separate (VENDOR_TYPE_DETAILS) because the landing page
// shows them as their own row and they skip the quiz.
export const PLAYER_TYPE_DETAILS: PlayerTypeDetail[] = [
  {
    type: "band",
    name: "Bands",
    headline: "Stop chasing gigs. Start landing them.",
    image: "/players/band.jpg",
    benefits: [
      "A profile built for bands: genres, set length, sound",
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
      "Direct messaging, no manager middlemen",
    ],
  },
];

// Backline, rental, and rehearsal businesses. Benefits only name things that
// exist: Discover and Ask AI search them, a venue can list them on a show once
// they accept, and contact goes through a Connect request.
export const VENDOR_TYPE_DETAILS: PlayerTypeDetail[] = [
  {
    type: "backline",
    name: "Backline",
    headline: "Get your gear on more stages.",
    image: "/players/backline.jpg",
    benefits: [
      "A profile listing the amps, drums, and stage gear you supply",
      "Venues can list you on their shows; you accept before it goes public",
      "Found in Discover and by SplitMic AI when a band needs gear",
    ],
  },
  {
    type: "instrument_rental",
    name: "Instrument Rental",
    headline: "Put your instruments in more hands.",
    image: "/players/instrument_rental.jpg",
    benefits: [
      "A profile of what you rent and for how long",
      "Get listed on shows and open mics that need a last-minute instrument",
      "Found in Discover and by SplitMic AI; reach out with a Connect request",
    ],
  },
  {
    type: "rehearsal_studio",
    name: "Rehearsal Studios",
    headline: "Fill your rooms with working bands.",
    image: "/players/rehearsal_studio.jpg",
    benefits: [
      "A profile for your space and the gear that comes with it",
      "Bands looking for a room find you in Discover and SplitMic AI",
      "Reach bands and venues with a Connect request, not a cold DM",
    ],
  },
];
