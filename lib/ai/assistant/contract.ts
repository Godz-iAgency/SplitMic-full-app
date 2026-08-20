/**
 * Shared types across the assistant's server action and its client UI.
 *
 * THE CENTRAL SAFETY PROPERTY OF THIS FILE: the model never emits a URL.
 *
 * Every link the user can click is built by our own code from a database row
 * or a verified API response, travels to the browser inside an
 * `AssistantCard.actions` entry, and is rendered by the UI. The model's text
 * is prose only — it describes results, it does not link to them. That's what
 * makes "never invent a URL" a structural guarantee rather than a instruction
 * the model has to be trusted to follow, and it's why tool results handed
 * back to the model deliberately omit URLs entirely (see tools.ts).
 */

/** Plain-text conversation turn. The only shape accepted from the browser. */
export type AssistantTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantAction = {
  label: string;
  href: string;
  /** External links open in a new tab and get rel="noopener noreferrer". */
  external: boolean;
};

export type AssistantCardKind = "member" | "business" | "event";

export type AssistantCard = {
  /** Stable within a response; used as the React key and for dedupe. */
  id: string;
  kind: AssistantCardKind;
  title: string;
  subtitle: string;
  /** Short chips: genres, capacity, date/time, free-or-paid. */
  meta: string[];
  imageUrl: string | null;
  /**
   * Where this record came from, shown verbatim on the card. Required by the
   * source-transparency rule: a Do512 listing must never be presented as a
   * Ticketmaster ticketed event.
   */
  source: string | null;
  actions: AssistantAction[];
};

export type AssistantResponse = {
  /** The model's prose. Empty string when the model produced only tool calls. */
  text: string;
  cards: AssistantCard[];
  /** Set when the request could not be answered at all. */
  error?: string;
  /** Surfaced in the UI so a degraded answer is never passed off as normal. */
  degraded?: boolean;
};

/** Caps that keep a forged or runaway client payload bounded. */
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_HISTORY_TURNS = 20;

export const EMPTY_RESPONSE: AssistantResponse = { text: "", cards: [] };
