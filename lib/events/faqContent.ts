/**
 * The 10 FAQ questions/answers rendered on /live, chosen for real Austin
 * live-music search intent (see the research behind them: "tonight," "free,"
 * "Live Music Capital of the World," "6th Street," etc.). Rendered both as
 * visible <details> elements and as FAQPage JSON-LD — both must read from
 * this single array so the two never drift apart.
 */

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Where can I find live music in Austin tonight?",
    answer:
      "The feed above lists tonight's shows in Austin, with the venue, artist, and start time for each, pulled fresh every day.",
  },
  {
    question: "What are the best live music venues in Austin, TX?",
    answer:
      "Austin has hundreds of venues, from small listening rooms to historic clubs like the Continental Club and Antone's to large amphitheaters like ACL Live. Browse tonight's and this week's shows above to see who's playing where.",
  },
  {
    question: "Is there free live music in Austin?",
    answer:
      "Yes, many Austin bars and venues host free shows on weeknights, and some run free live music every night of the week. Free shows are marked on the events above when the listing indicates no cover.",
  },
  {
    question: 'Why is Austin called the "Live Music Capital of the World"?',
    answer:
      "Austin has more live music venues per capita than any other U.S. city, and the title dates back to the city's own music-scene research in the early 1990s. The long-running PBS series Austin City Limits, filmed here since 1974, cemented the reputation nationally.",
  },
  {
    question: "What live music is happening in Austin this weekend?",
    answer:
      "Switch to the \"This Week\" view above to see shows through the weekend, not just tonight.",
  },
  {
    question: "What time does live music usually start at Austin bars and venues?",
    answer:
      "Most club shows have doors around 7-9pm, with headliners going on later. Bars with nightly music often start earlier, around sunset, and some venues run late sets after 10pm.",
  },
  {
    question: "Where can I see live music on 6th Street?",
    answer:
      "6th Street is Austin's densest strip of bars and clubs, many with live music every night. Walk a few blocks and you'll pass several stages. Check the feed above for who's actually playing there tonight.",
  },
  {
    question: "What neighborhood in Austin has the best live music scene?",
    answer:
      "Live music is spread across the city: 6th Street and the Red River District for clubs, Rainey Street for a bar-crawl vibe, South Congress for a mix of listening rooms and honky-tonks, and East Austin for a newer wave of venues.",
  },
  {
    question: "Does Austin have live music every night of the week?",
    answer:
      "Yes, a number of Austin venues book live music seven nights a week, which is part of why the city earned its \"Live Music Capital\" reputation.",
  },
  {
    question: "How do I find local bands playing in Austin?",
    answer:
      "Browse SplitMic's directory of Austin bands, or check the live feed above to see which local acts have shows coming up.",
  },
];
