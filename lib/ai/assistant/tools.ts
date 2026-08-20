import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolDefinition, ToolCall } from "@/lib/ai/providers";
import type { AssistantCard, AssistantAction } from "./contract";
import type { PlayerType } from "@/lib/types";
import { GENRES } from "@/lib/genres";
import { searchProfiles } from "@/lib/supabase/search";
import {
  CATEGORY_META,
  DIRECTORY_CATEGORIES,
  type DirectoryCategory,
} from "@/lib/directory/categories";
import { getUpcomingEvents, type LiveEventCard } from "@/lib/events/queries";
import { selectTonightEvents, selectThisWeekEvents } from "@/lib/events/filters";
import { isToday } from "@/lib/events/time";
import { buildTicketLink, buildDirectionsUrl } from "@/lib/events/getThereLinks";
import { formatEventTime, formatEventDayLabel } from "@/lib/events/time";

/**
 * The assistant's tool layer: what the model is allowed to ask for, and the
 * real queries that answer it.
 *
 * Two rules shape every function here.
 *
 * 1. THE MODEL NEVER SEES A URL. Each tool returns `summary` (what goes back
 *    to the model) and `cards` (what the UI renders). Only `cards` carry
 *    links, and they're built by our code from database rows. A model that is
 *    never shown a URL cannot repeat a wrong one or invent a plausible one.
 *
 * 2. TOOLS RUN AS THE USER. Every query uses the caller's own Supabase
 *    client, so RLS and the directory's column GRANTs (which hide scraped
 *    contact emails — see migrations/step11_business_directory.sql) apply
 *    unchanged. The AI layer gets no privilege the signed-in user lacks.
 *
 * On tool granularity: the spec this was built from lists a separate tool per
 * entity (search_bands, search_venues, …). They're collapsed into one
 * parameterized search per *data source* instead, because that's the shape the
 * data actually has — `player_type` and `category` are real columns — and
 * because three well-described tools get selected far more reliably than
 * twenty near-identical ones.
 */

/** Per-tool result cap. Enough to choose from, few enough to read on a phone. */
const MAX_RESULTS = 6;

export type ToolContext = {
  supabase: SupabaseClient;
  /** The caller's own player type, used to tailor phrasing. May be null. */
  viewerPlayerType: PlayerType | null;
  now: Date;
};

export type ToolOutcome = {
  /** Goes back to the model. Compact, factual, and URL-free by construction. */
  summary: unknown;
  /** Goes to the browser. The only place links exist. */
  cards: AssistantCard[];
};

// ── Tool definitions ────────────────────────────────────────────────────────

const MEMBER_TYPES: PlayerType[] = [
  "band",
  "venue",
  "talent_buyer",
  "record_label",
  "festival",
];

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "search_splitmic_members",
    description:
      "Search real SplitMic member accounts: bands, venues, talent buyers, record labels, and festivals. These are signed-up users with profiles the viewer can open and contact. Prefer this over the directory when the user wants someone to work with, book, or contact. Does not cover rehearsal studios, backline, or instrument rental — those are directory-only.",
    parameters: {
      type: "object",
      properties: {
        player_type: {
          type: "string",
          description: "Which kind of member to search for.",
          enum: [...MEMBER_TYPES],
        },
        genre: {
          type: "string",
          description:
            "Musical genre to filter by. Only use a value from the list. Omit if the user did not name a genre.",
          enum: [...GENRES],
        },
        query: {
          type: "string",
          description:
            "Free-text name search, e.g. a specific band or venue name. Omit for a general browse.",
        },
      },
      required: ["player_type"],
    },
  },
  {
    name: "search_austin_directory",
    description:
      "Search the curated Austin music-business directory. This is the ONLY source for rehearsal studios, backline companies, and instrument rental. Listings carry a name, website, phone, and description — they do NOT carry availability, pricing, or booking data, so never state or imply that a listing is available or bookable.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Which kind of business to search for.",
          enum: [...DIRECTORY_CATEGORIES],
        },
        query: {
          type: "string",
          description: "Optional free-text name search.",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "search_live_events",
    description:
      "Search real upcoming Austin live-music events already synced into SplitMic from Ticketmaster and Do512. Use for any question about what is happening tonight, this week, or on a given date.",
    parameters: {
      type: "object",
      properties: {
        when: {
          type: "string",
          description:
            "Time window. 'tonight' for today, 'this_week' for the next several days, 'date' to use the date field.",
          enum: ["tonight", "this_week", "date"],
        },
        date: {
          type: "string",
          description:
            "Specific calendar date as YYYY-MM-DD. Only used when when='date'.",
        },
        price: {
          type: "string",
          description:
            "Filter by cost. 'free' returns only shows confirmed free; 'paid' returns everything not confirmed free.",
          enum: ["free", "paid"],
        },
        genre: {
          type: "string",
          description:
            "Optional genre to filter by, matched loosely against the event's own genre label.",
        },
        venue: {
          type: "string",
          description: "Optional venue name to filter by, matched loosely.",
        },
      },
      required: ["when"],
    },
  },
];

// ── Dispatch ────────────────────────────────────────────────────────────────

/**
 * Runs one model-requested tool. Unknown names and bad arguments come back as
 * a normal `summary` the model can react to, never a thrown error — a
 * hallucinated tool name should produce "that isn't something I can look up",
 * not a 500.
 */
export async function runTool(
  call: ToolCall,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  switch (call.name) {
    case "search_splitmic_members":
      return searchMembers(call.args, ctx);
    case "search_austin_directory":
      return searchDirectory(call.args, ctx);
    case "search_live_events":
      return searchEvents(call.args, ctx);
    default:
      return {
        summary: { error: `Unknown tool: ${call.name}` },
        cards: [],
      };
  }
}

// ── search_splitmic_members ─────────────────────────────────────────────────

async function searchMembers(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const playerType = asEnum(args.player_type, MEMBER_TYPES);
  if (!playerType) {
    return {
      summary: { error: "player_type must be one of: " + MEMBER_TYPES.join(", ") },
      cards: [],
    };
  }

  const genre = asString(args.genre);
  const { cards: found } = await searchProfiles(ctx.supabase, {
    playerType,
    query: asString(args.query) ?? undefined,
    genre: genre && GENRES.includes(genre as (typeof GENRES)[number]) ? genre : undefined,
  });

  const top = found.slice(0, MAX_RESULTS);

  return {
    summary: {
      found: found.length,
      showing: top.length,
      player_type: playerType,
      results: top.map((c) => ({
        name: c.display_name,
        description: c.one_liner,
        genres: c.genres,
      })),
    },
    cards: top.map((c) => ({
      id: `member:${c.profile_id}`,
      kind: "member" as const,
      title: c.display_name,
      subtitle: c.one_liner || CATEGORY_META[c.player_type as DirectoryCategory]?.label || "",
      meta: c.genres.slice(0, 3),
      imageUrl: c.avatar_url,
      source: "SplitMic",
      actions: [
        { label: "View profile", href: `/profile/${c.profile_id}`, external: false },
      ],
    })),
  };
}

// ── search_austin_directory ─────────────────────────────────────────────────

type DirectoryRow = {
  id: string;
  category: string;
  business_name: string;
  website_url: string | null;
  phone: string | null;
  description: string | null;
  subcategory: string | null;
  claimed_profile_id: string | null;
};

async function searchDirectory(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const category = asEnum(args.category, [...DIRECTORY_CATEGORIES]);
  if (!category) {
    return {
      summary: {
        error: "category must be one of: " + DIRECTORY_CATEGORIES.join(", "),
      },
      cards: [],
    };
  }

  // Only the columns granted to `authenticated` in step11. Requesting `email`
  // here would fail the query outright — that grant list is the security
  // boundary, and this select deliberately stays inside it.
  let query = ctx.supabase
    .from("directory_businesses")
    .select(
      "id, category, business_name, website_url, phone, description, subcategory, claimed_profile_id",
    )
    .eq("category", category)
    .eq("is_active", true);

  const search = asString(args.query);
  if (search) query = query.ilike("business_name", `%${search}%`);

  const { data, error } = await query
    .order("tier_rank", { ascending: true })
    .order("business_name", { ascending: true })
    .limit(MAX_RESULTS);

  if (error) {
    return { summary: { error: "Directory lookup failed" }, cards: [] };
  }

  const rows = (data ?? []) as DirectoryRow[];
  const meta = CATEGORY_META[category];

  return {
    summary: {
      found: rows.length,
      category: meta.label,
      // Stated explicitly so the model doesn't fill the gap with an assumption
      // and offer to book something the data can't support.
      note: "Directory listings have no availability, pricing, or booking data.",
      results: rows.map((r) => ({
        name: r.business_name,
        description: r.description ?? null,
        subcategory: r.subcategory ?? null,
        has_website: Boolean(r.website_url),
        has_phone: Boolean(r.phone),
      })),
    },
    cards: rows.map((r) => ({
      id: `business:${r.id}`,
      kind: "business" as const,
      title: r.business_name,
      subtitle: r.description ?? meta.label,
      meta: r.subcategory ? [r.subcategory] : [],
      imageUrl: null,
      source: "SplitMic Directory",
      actions: buildDirectoryActions(r, category),
    })),
  };
}

function buildDirectoryActions(
  row: DirectoryRow,
  category: DirectoryCategory,
): AssistantAction[] {
  const actions: AssistantAction[] = [];

  // A claimed listing has a real SplitMic profile behind it — that's a better
  // destination than the external site because the user can act on it here.
  if (row.claimed_profile_id) {
    actions.push({
      label: "View profile",
      href: `/profile/${row.claimed_profile_id}`,
      external: false,
    });
  }
  if (row.website_url) {
    actions.push({ label: "Visit website", href: row.website_url, external: true });
  }
  if (row.phone) {
    actions.push({ label: "Call", href: `tel:${row.phone}`, external: true });
  }
  // Always available, and the reason there's no "Book" action anywhere here:
  // there is no per-business page and no booking data, so the category page is
  // the most specific honest destination.
  actions.push({
    label: `Browse ${CATEGORY_META[category].plural}`,
    href: `/directory/${CATEGORY_META[category].slug}`,
    external: false,
  });

  return actions;
}

// ── search_live_events ──────────────────────────────────────────────────────

async function searchEvents(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const when = asEnum(args.when, ["tonight", "this_week", "date"]) ?? "tonight";
  const all = await getUpcomingEvents(ctx.supabase, { now: ctx.now });

  let scoped: LiveEventCard[];
  if (when === "tonight") {
    scoped = selectTonightEvents(all, ctx.now);
  } else if (when === "this_week") {
    scoped = selectThisWeekEvents(all, ctx.now);
  } else {
    const date = asString(args.date);
    scoped = date ? all.filter((e) => onCalendarDate(e, date)) : all;
  }

  const price = asEnum(args.price, ["free", "paid"]);
  if (price === "free") scoped = scoped.filter((e) => e.isFree === true);
  // "paid" is "not confirmed free", matching the /live filter's definition —
  // Ticketmaster rows carry isFree = null rather than a guess, so a strict
  // `=== false` would hide nearly every real ticketed show.
  if (price === "paid") scoped = scoped.filter((e) => e.isFree !== true);

  // Loose matching rather than the exact comparison the /live dropdowns use:
  // those pick from a list of values known to exist, while a model passes
  // through whatever the human typed.
  const genre = asString(args.genre);
  if (genre) scoped = scoped.filter((e) => looselyMatches(e.genre, genre));

  const venue = asString(args.venue);
  if (venue) scoped = scoped.filter((e) => looselyMatches(e.venueName, venue));

  const top = scoped.slice(0, MAX_RESULTS);

  return {
    summary: {
      found: scoped.length,
      showing: top.length,
      window: when,
      results: top.map((e) => ({
        artist: e.artistName,
        venue: e.venueName,
        when: `${formatEventDayLabel(e.eventDatetime, ctx.now)} ${formatEventTime(e.eventDatetime)}`,
        // Reported as three distinct states, never collapsed to a boolean: an
        // unknown price must not be described as either free or paid.
        price: e.isFree === true ? "free" : e.isFree === false ? "ticketed" : "unknown",
        source: sourceLabel(e.source),
        // Three states, not a boolean: "tickets" means a real point of sale,
        // "listing" means the link is an events-calendar page. Collapsing them
        // is what lets a model describe a free open-mic as being on sale.
        link_type: linkType(e),
      })),
    },
    cards: top.map((e) => ({
      id: `event:${e.id}`,
      kind: "event" as const,
      title: e.artistName,
      subtitle: e.venueName,
      meta: [
        `${formatEventDayLabel(e.eventDatetime, ctx.now)} · ${formatEventTime(e.eventDatetime)}`,
        ...(e.isFree === true ? ["Free"] : []),
        ...(e.genre ? [e.genre] : []),
      ],
      imageUrl: e.imageUrl ?? e.directoryPhotoUrl,
      source: sourceLabel(e.source),
      actions: buildEventActions(e),
    })),
  };
}

/** "tickets" only when the destination actually sells them. */
function linkType(event: LiveEventCard): "tickets" | "listing" | null {
  const link = buildTicketLink(event);
  if (!link) return null;
  return link.isCheckout ? "tickets" : "listing";
}

function buildEventActions(event: LiveEventCard): AssistantAction[] {
  const actions: AssistantAction[] = [];

  // Straight from the stored row via the shared builder — the same function
  // the /live cards use, so the assistant can never link somewhere the rest of
  // the app wouldn't, and can never label a listing page as a checkout.
  // Absent ticket_url means no button, not a guessed one.
  const ticketLink = buildTicketLink(event);
  if (ticketLink) {
    actions.push({
      label: ticketLink.label,
      href: ticketLink.href,
      external: true,
    });
  }
  actions.push({
    label: "Directions",
    href: buildDirectionsUrl(event),
    external: true,
  });
  if (event.directoryBusinessId) {
    actions.push({ label: "About the venue", href: "/directory/venues", external: false });
  }

  return actions;
}

/** Human-facing provenance. Anything unrecognized reports as-is, never guessed. */
function sourceLabel(source: string): string {
  if (source === "ticketmaster") return "Ticketmaster";
  if (source === "do512") return "Do512";
  return source;
}

function looselyMatches(value: string | null, wanted: string): boolean {
  if (!value) return false;
  const a = value.toLowerCase();
  const b = wanted.trim().toLowerCase();
  return a.includes(b) || b.includes(a);
}

/** Austin-local calendar-date comparison, reusing the app's own cycle logic. */
function onCalendarDate(event: LiveEventCard, isoDate: string): boolean {
  const target = new Date(`${isoDate}T12:00:00-05:00`);
  if (Number.isNaN(target.getTime())) return false;
  return isToday(event.eventDatetime, target);
}

// ── Argument coercion ───────────────────────────────────────────────────────
// Model arguments are untrusted: the schema is a strong hint, not a contract.

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asEnum<T extends string>(value: unknown, allowed: T[]): T | null {
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as T)
    : null;
}
