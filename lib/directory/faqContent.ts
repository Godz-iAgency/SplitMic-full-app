import type { DirectoryCategory } from "./categories";

/**
 * Per-category FAQ copy. Rendered as visible <details> elements AND as
 * FAQPage JSON-LD — both read from this one array, because Google's
 * structured-data policy requires the markup to match what a visitor sees.
 */

export type FaqItem = { question: string; answer: string };

export const FAQ_BY_CATEGORY: Record<DirectoryCategory, FaqItem[]> = {
  venue: [
    {
      question: "How many live music venues are there in Austin?",
      answer:
        "Austin has hundreds of venues booking live music, from small clubs and dancehalls to concert halls, arenas, and outdoor amphitheaters. This directory lists the Austin-area venues we've verified as active.",
    },
    {
      question: "How do I book a show at an Austin venue?",
      answer:
        "Most venues book through a talent buyer or a booking email rather than walk-ins. Find the venue here, use its listed website or phone, and have your press kit, draw numbers, and available dates ready before you reach out.",
    },
    {
      question: "What size venues are in this directory?",
      answer:
        "All of them. Listings are grouped as clubs and small venues, concert halls and performing arts centers, auditoriums and arenas, and stadiums and amphitheaters.",
    },
    {
      question: "Is my venue listed here?",
      answer:
        "If you run an Austin venue and don't see it, or your details are wrong, sign up for SplitMic and claim your listing so you control what it says.",
    },
  ],
  band: [
    {
      question: "How do I find local bands in Austin?",
      answer:
        "Browse this directory by genre, or check SplitMic's live feed to see which Austin acts have shows coming up this week.",
    },
    {
      question: "How do I book an Austin band for an event?",
      answer:
        "Each listing links to the band's own site or socials. Reach out directly with your date, budget, venue, and set length.",
    },
    {
      question: "How can my band get listed?",
      answer:
        "Sign up for SplitMic as a band. Published band profiles appear across the platform, and you can be matched to talent buyers looking for your sound.",
    },
  ],
  talent_buyer: [
    {
      question: "What does a talent buyer do?",
      answer:
        "A talent buyer decides which artists get booked at a venue or festival, negotiates the terms, and builds the calendar. If you want to play a room, the talent buyer is usually the person who says yes.",
    },
    {
      question: "How do I pitch an Austin talent buyer?",
      answer:
        "Keep it short: who you are, your sound, your draw in Austin, links to live audio or video, and the dates you want. Talent buyers get a lot of email, so lead with the numbers that matter.",
    },
    {
      question: "Are these booking agents or talent buyers?",
      answer:
        "Both. The directory covers Austin-area booking agents, talent buyers, and promoters, since in practice the roles overlap at smaller venues.",
    },
  ],
  record_label: [
    {
      question: "What record labels are based in Austin?",
      answer:
        "Austin has a deep independent label scene spanning psych, country, punk, electronic, and more. This directory lists Austin-area labels with active contact details.",
    },
    {
      question: "How do I submit music to a label?",
      answer:
        "Check the label's own site first: most publish submission guidelines, and many don't take unsolicited demos. Sending the wrong thing to the wrong label is the most common mistake.",
    },
  ],
  festival: [
    {
      question: "What music festivals happen in Austin?",
      answer:
        "Austin hosts festivals year round, from SXSW and Austin City Limits to dozens of smaller genre and neighborhood festivals. This directory lists them with their season and location.",
    },
    {
      question: "How do bands get booked for an Austin festival?",
      answer:
        "Most festivals book months ahead through an application window or a talent buyer. Check each festival's site for its submission dates, and start earlier than feels necessary.",
    },
  ],
  rehearsal_studio: [
    {
      question: "How much does a rehearsal space cost in Austin?",
      answer:
        "Hourly rooms typically start around $10 to $20 an hour, and monthly lockouts generally start near $175, depending on room size, gear included, and access hours. Check each studio for current rates.",
    },
    {
      question: "Do Austin rehearsal studios provide gear?",
      answer:
        "Many hourly rooms include a drum kit and PA, and some include amps. Monthly lockouts usually expect you to bring your own. Confirm before you book.",
    },
    {
      question: "What's the difference between hourly and a monthly lockout?",
      answer:
        "Hourly rooms are shared and booked per session. A lockout is your own room, kept month to month, where you can leave gear set up.",
    },
  ],
  instrument_rental: [
    {
      question: "Where can I rent instruments in Austin?",
      answer:
        "This directory lists Austin-area shops and companies renting instruments and gear, from school band instruments to professional stage equipment.",
    },
    {
      question: "Can I rent gear for a single show?",
      answer:
        "Yes. Several Austin companies do short-term and single-event rentals, and some deliver and set up at the venue. That service is usually called backline.",
    },
  ],
  backline: [
    {
      question: "What is backline?",
      answer:
        "Backline is the stage gear a band plays through (drums, amps, keyboards), as opposed to the PA the venue provides. Touring acts and festivals often rent it locally instead of hauling it.",
    },
    {
      question: "When do I need a backline company?",
      answer:
        "When you're flying in, playing a festival that requires shared gear, or need something specific your own rig can't cover. Most Austin backline companies deliver, set up, and strike.",
    },
    {
      question: "How far ahead should I book backline?",
      answer:
        "As early as you can, especially during SXSW and ACL weekends, when Austin's backline inventory books out well in advance.",
    },
  ],
};
