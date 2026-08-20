# SplitMic

Austin-focused music-industry network connecting bands, venues, talent buyers,
record labels, and festivals on one platform. Everything the app surfaces —
live shows, venues, the directory — is Austin-only; membership is open to
anywhere in Texas, since plenty of players commute in for Austin gigs.

For current status, in-flight work, and the decision log, see
[`PROGRESS.md`](PROGRESS.md). For the engineering standards and guardrails that
apply to changes here, see [`CLAUDE.md`](CLAUDE.md). For the database schema
history (including some unused legacy tables), see
[`migrations/SCHEMA_HISTORY.md`](migrations/SCHEMA_HISTORY.md).
This file covers setup and a tour of the codebase.

## Stack

- Next.js 14 (App Router, TypeScript, server actions)
- Supabase (Postgres, Auth, Storage, Row Level Security)
- Tailwind CSS
- Google Maps Geocoding API (`/api/validate-address` — built but **not currently wired into onboarding**, which validates client-side instead)
- Google Gemini API (AI show-matching for talent buyers)
- Resend (transactional email)
- Firecrawl (scrapes Austin live-music listings for `/live`)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without a session you're redirected to `/login`.

## Environment variables

Copy `.env.example` to `.env.local` and fill in every value.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-only, bypasses RLS — admin moderation
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_APP_URL=             # site origin for links in emails; defaults to https://splitmic.com
RESEND_API_KEY=
NOTIFY_FROM_EMAIL=               # user notification emails; falls back to a Resend shared address
SUPPORT_FROM_EMAIL=              # support form emails; same fallback
GEMINI_API_KEY=                  # AI show-matching + SplitMic AI (primary); needs the Generative Language API enabled
GEMINI_MODEL=                    # optional override; defaults to gemini-2.5-flash
GROQ_API_KEY=                    # SplitMic AI fallback provider — optional but strongly recommended
GROQ_MODEL=                      # optional override; catalog is account-scoped, see "SplitMic AI" below
FREE_AI_MESSAGES_PER_DAY=        # assistant questions per account per day; defaults to 50
FIRECRAWL_API_KEY=               # Scrapes Do512 for the /live page's daily sync job
TICKETMASTER_API_KEY=            # Discovery API — server-only, never exposed to the frontend
CRON_SECRET=                     # Shared by every scheduled endpoint (see "Scheduled jobs" below)
```

> **Never commit `.env.local`.** Rotate any credential that's been pasted into a chat, ticket, or doc.

## Supabase setup

1. **Auth → Providers → Google** — enable it, using the same client ID/secret as above.
2. **Auth → URL Configuration → Redirect URLs** — add:
   - `http://localhost:3000/auth/callback`
   - `https://<your-production-domain>/auth/callback`
3. **Auth → URL Configuration → Site URL** — your production domain (or `http://localhost:3000` while developing).
4. **Storage** — a `profile-media` bucket, public read, for avatars/banners/gallery photos/intro videos.
5. **Database** — run every file in [`migrations/`](migrations) in numeric order (`step1`, `step4`, `step5`, `step5_fix`, `step6` … ). There is no `step2`/`step3` file; see `migrations/SCHEMA_HISTORY.md` for why. RLS policies are defined inline in each migration file.
6. **Resend** — verify your sending domain before real users need to receive email; until then, delivery is best-effort to the account owner's own inbox (see `.env.example` notes above).

## Project structure

```
app/                      Next.js App Router — one folder per route
  admin/                  Admin console (stats, moderation, action log)
  auth/callback/          OAuth code exchange + first-time users row
  directory/              Public Austin music business directory — no login required
  inbox/                  DM threads + connection requests
  live/                   Public "Austin Live Music" page — no login required
  match/                  AI show-matching (talent buyers only)
  onboarding/              3-step signup flow (player type → address → profile)
  opportunities/          Marketplace: events, opportunities, open mic rosters
  profile/                Public profile view + owner edit flow
  search/                 Discover (browse/filter published profiles)
  support/                Contact form

components/               One folder per feature area, mirrors app/
lib/
  ai/                     Gemini client + show-matching extraction
  directory/              CSV parsing/import + directory queries, JSON-LD, FAQ copy
  events/                 Do512 + Ticketmaster providers, sync, dedupe, filters, profile matching, JSON-LD (see "Live events" below)
  scoring/                Band Readiness Score
  supabase/               Server-side query/action helpers (search, messaging, marketplace, profile)
  notifications/          Transactional email
  http/                   Shared HTTP helpers (cron bearer-token auth)

migrations/                Hand-run SQL migrations (run in the Supabase SQL editor, in order)
```

## Player types

`band`, `venue`, `talent_buyer`, `record_label`, `festival` — see `lib/types.ts`
for the full field shape of each. Every profile shares common fields (name,
bio, contact info) plus a type-specific detail table.

## Core flows, in brief

- **Onboarding** — 3 steps: player type → Texas address (street, city, ZIP; the ZIP rule lives in `lib/address/texas.ts`) → player-type-specific profile form. Immediately after, the user lands on `/profile/edit` to add photos/video, which auto-publishes the profile on save.
- **Discover** — browse/search published profiles by type, genre, and text query.
- **Marketplace (Opportunities)** — industry players post events/opportunities/open mics; bands can be tagged, apply, or sign up (open mic).
- **Connections & Messaging** — industry accounts can DM directly; bands send a Connect request that the other side accepts/declines, opening a thread.
- **AI show-matching** (`/match`, talent buyers only) — describe a show in plain English, Gemini extracts genre/draw/size/vibe criteria, we rank published bands against it using our own data (Gemini never ranks or sees band data directly).
- **Admin console** (`/admin`) — gated to a hardcoded email allowlist in `lib/supabase/admin.ts`.

## Business directory

`/directory` is a public, no-login guide to Austin's music industry across 8
categories (venues, bands, talent buyers, record labels, festivals, rehearsal
studios, instrument rental, backline), with one indexable page per category at
`/directory/<slug>`.

These listings are **not** SplitMic accounts. `profiles` holds real signed-up
players; `directory_businesses` holds mostly-unclaimed scraped leads. When a
business does sign up, an admin links the two via `claimed_profile_id` and the
card starts pointing at the real profile.

**Importing.** Source data is a scraped CSV at the project root
(`business_directory_scraped.csv`, gitignored — it holds hundreds of
third-party contact emails). Import it from `/admin/directory`: **Dry run**
first to see the insert/update/unchanged counts, then **Import now**. Run it
from `npm run dev` locally so the file is on disk, or paste the CSV into the
box on that screen.

Re-importing is safe by design: an existing row only ever has its *scraped*
fields refreshed. Tier, outreach status, notes, and profile links are never
touched, so a re-import can't undo hand curation. `lib/directory/import.test.ts`
has a regression test asserting exactly that.

**Tiers.** `standard` / `featured` / `spotlight` control both sort order and
visual treatment — spotlight listings render full-width above the grid. Set
them in `/admin/directory`.

**Card imagery** comes from three sources, tried in that order — the
business's own preview photo, then a screenshot of its website, then a
gradient. All free: no Google billing anywhere in this feature.

- **Open Graph images** (`lib/directory/ogImage.ts`) are each business's own
  link-preview photo — the same image that shows up when their site is shared
  on iMessage/Facebook/etc. Free: no API key, just reading one meta tag off
  their page. Run from `/admin/directory` in batches. (A Google Places photo
  pipeline was built and removed here — its API is billed and its photo URLs
  expire, needing periodic re-fetching to stay working. `migrations/step13_directory_places.sql`
  is left in place as harmless unused schema history, same as the step2/step3
  gap documented in `SCHEMA_HISTORY.md`.)
- **Logos** are derived at render time from each site's favicon via Google's
  endpoint (`lib/directory/media.ts`). Nothing stored, no API key, no credits.
  That endpoint returns a generic globe rather than 404ing, so there's no error
  branch; listings with no website fall back to an initial letter.
- **Screenshots** are captured through Firecrawl and stored in the existing
  `profile-media` bucket under `directory/screenshots/`. Run them from
  `/admin/directory` in batches — **one Firecrawl credit per listing
  attempted**. The job is resumable and only ever picks up rows never tried
  (`screenshot_status IS NULL`), so a row is never captured or paid for twice.
  Failures are marked `failed` and only retried when you explicitly click
  "Retry failed". Cards without a screenshot show a brand gradient, so a
  partial backfill still looks deliberate.

**Filtering.** `?q=` searches name/description/subcategory; `?sub=` filters to
an exact subcategory (venue type, band genre, festival season), populated from
whatever values the data actually contains. The subcategory chip on every card
is a link to that filter.

**Privacy.** Scraped emails and the outreach pipeline are readable only by the
service role. RLS alone wouldn't do this (it's row-level, and the public anon
key can query any readable column), so
`migrations/step11_business_directory.sql` also revokes the blanket column
grant and re-grants only the public-facing columns. Don't remove that block.

## Live events

`/live` is a public, no-login page showing Austin live music happening today
and this week — the entry point for "Austin live music" search traffic.

Events come from two providers, each mapping its own raw data into the same
provider-agnostic row shape (`LiveEventInsert`, defined in
`lib/events/do512.ts`) before a single shared pipeline (`upsertProviderRows`
in `lib/events/sync.ts`) matches, upserts, and deactivates — the frontend
never needs to know which provider a row came from:

- **Do512** (`lib/events/do512.ts`) — scraped daily via Firecrawl by the
  `sync-events` cron job below. Especially useful for free/local shows Do512
  covers that never touch Ticketmaster.
- **Ticketmaster** (`lib/events/providers/ticketmaster.ts`) — the Discovery
  API, filtered to Austin/TX music events, pulled every ~4 hours (see
  "Scheduled jobs"). Requires `TICKETMASTER_API_KEY`. Especially useful for
  ticketed shows with a real "Buy Tickets" link, genre, and image.

The same real-world show occasionally appears in both — `lib/events/dedupe.ts`
collapses those at read time (never at write time, and never by deleting
anything) into one card, preferring Ticketmaster's richer data when both
exist. Adding a third provider (Eventbrite, say) means a new file following
the same "raw → `LiveEventInsert`" shape, not a change to the shared pipeline.

Events are matched against SplitMic's own published band/venue profiles
where possible (`lib/events/matching.ts`), and stored in `live_events`
(public read, service-role-only writes — see `migrations/step10_live_events.sql`
and `migrations/step18_live_events_ticketmaster.sql`). The page also carries a
10-question FAQ and JSON-LD structured data (`MusicEvent` per show, `FAQPage`)
built from the same content it renders, so search engines and AI answer
engines see exactly what a visitor sees.

Besides the Tonight/This Week toggle, cards can be filtered by Free/Paid,
genre, and venue (`lib/events/filters.ts`, unit-tested pure predicates —
same pattern as `time.ts`'s `isToday`/`isUpcoming`). Genre and venue options
are built from whatever values are actually present in the current feed, not
a fixed list — Ticketmaster's classification genres don't line up
string-for-string with `lib/genres.ts`'s onboarding taxonomy, so that list
isn't reused here.

Each card also cross-references the venue name against the business
directory (`matching.ts`'s `findDirectoryVenueMatch`, independent of the
band/artist match above — a matched band never suppresses the venue check).
When a match exists the whole card links out — a real SplitMic venue profile
first, else the directory listing — and the venue's own directory photo fills
the image band whenever Do512 didn't give the event its own poster. A
deactivated (confirmed-dead) directory listing is treated as no match, since
that's re-checked live in `getUpcomingEvents`, not trusted from the sync-time
snapshot. "Tonight" and "This Week" are a strict partition, not overlapping
sets — a show happening tonight only shows under the Tonight tab.

Neither tab ever renders empty. If a sync gap leaves nothing dated for the
current window, `selectTonightEvents` / `selectThisWeekEvents`
(`lib/events/filters.ts`) fall back to the most recent listings that did sync,
because "no shows tonight in Austin" is almost never true and reads as a broken
page rather than as stale data.

An event's outbound link is decided by `buildTicketLink`, not by whether a URL
exists. Only sources that genuinely sell tickets (currently Ticketmaster) get
**Buy Tickets**; everything else gets **Event details**, because a Do512 URL is
that show's page on an events calendar, not a checkout. A new provider is
treated as a listing until it's explicitly added to `TICKETING_SOURCES`.

## SplitMic AI (`/assistant`)

An authenticated conversational layer over the data the directory, search, and
`/live` already expose. It adds no new data — it's a different way in.

**Flow:** the user's message and the prior turns go to a model with three
read-only tools; the model picks one, the backend runs the real query, and the
model writes prose around the results while the UI renders the rows as cards.

| Tool | Backed by |
|---|---|
| `search_splitmic_members` | `searchProfiles` — the 5 real player types |
| `search_austin_directory` | `directory_businesses` — the 8 scraped categories |
| `search_live_events` | `getUpcomingEvents` + the `/live` selectors |

**Providers** (`lib/ai/providers/`): Gemini primary, Groq fallback. Only
*retryable* failures (429, 5xx, timeout) fall through — a bad key or malformed
request fails identically on both, so retrying would just burn the second
quota. The conversation is provider-independent, so a mid-conversation switch
carries full context. Groq's model catalog is **account-scoped**: check
`https://api.groq.com/openai/v1/models` before setting `GROQ_MODEL` — the
common Llama ids 404 on some accounts.

**Three things are load-bearing and shouldn't be "simplified":**

1. **The model never emits a URL.** Tool results handed back to it contain no
   URLs at all; every link is built server-side into `AssistantCard.actions`
   and rendered by the UI. `stripUrls` removes any address that appears anyway.
   This is what makes "never invent a link" structural rather than a request.
2. **Tools run on the caller's own Supabase client**, so RLS and the
   directory's column grants (which hide scraped contact emails) apply to the
   AI unchanged. The AI gets no privilege the signed-in user lacks.
3. **Only plain user/assistant text is accepted from the browser.** Tool calls
   and results are never replayed from the client — a forged tool result would
   let a caller feed invented "search results" in and have them narrated as
   fact.

**Limits and logging:** `ai_usage_events` (migration `step19`) backs a
per-account daily cap — our number, not a provider's, since free tiers change
without notice. It deliberately stores no message text, only shape: provider,
model, whether the request fell back, tool-call and result counts, latency.
`checkDailyLimit` fails *open* on a query error; the cap is a cost guardrail,
not a security control.

## Scheduled jobs

Every job below shares one `CRON_SECRET` and the same auth pattern
(`lib/http/cronAuth.ts`): `Authorization: Bearer $CRON_SECRET`, fails closed
(never runs unauthenticated) if the secret is unset — any scheduler that can
send that header works, Vercel Cron is not required.

```bash
# Do512 sync — dry run (report only, writes nothing)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/sync-events?dryRun=1"

# Ticketmaster sync — dry run
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/sync-ticketmaster?dryRun=1"
```

`vercel.json` schedules the Do512 sync (`sync-events`) once daily — Vercel's
Hobby tier hard-caps cron jobs at once per day, confirmed directly against
their docs. Ticketmaster listings benefit from fresher data than that, so
`sync-ticketmaster` is deliberately **not** on Vercel's own cron — instead,
`.github/workflows/sync-ticketmaster.yml` triggers it externally every 4
hours via GitHub Actions (free, no paid Vercel plan needed). One-time setup:
add a `CRON_SECRET` repository secret with the same value as the deployed env
var; nothing else to configure.

### Scheduled cleanup

Marketplace posts have two separate clocks, and they are not the same thing:

| | When | What it does |
|---|---|---|
| **Soft expiry** | 7 days after the event / open-until date | Post stops appearing in the Feed. Deletes nothing. Computed by a DB trigger into `expires_at`. |
| **Retention** | 1 year after that | Row is permanently deleted. |

The long gap is deliberate. A post is the **only** place a show's history lives:
`event_band_tags` (which bands accepted a gig) and `open_mic_signups` (the
running order and who checked in) both cascade-delete with it. Deleting at soft
expiry would wipe a venue's open mic roster a week after the night happened.

`GET /api/cron/cleanup-posts` runs the job. It requires
`Authorization: Bearer $CRON_SECRET` and refuses to run at all if `CRON_SECRET`
is unset, so it can never run unauthenticated.

```bash
# See what would be deleted, without deleting
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/cleanup-posts?dryRun=1"
```

Runs weekly. Retention can be overridden per call (`?retentionDays=730`), but
anything under 30 days is rejected — that would delete history still in use.

## Skipping deploys for docs-only changes

`scripts/vercel-ignore-build-step.sh` skips the Vercel build when a push
touches nothing but Markdown — a `PROGRESS.md` update doesn't need a full
Next.js build. This is a **project setting, not something `vercel.json`
controls**: in Vercel → Project → Settings → Git → Ignored Build Step, set

```
bash scripts/vercel-ignore-build-step.sh
```

The script fails open — any deploy on a fresh branch or a shallow clone
missing history builds anyway rather than risk silently skipping a build that
was actually needed. Verified locally against real commits: `git diff --quiet`
correctly distinguished the docs-only `PROGRESS.md` commit from mixed and
code-only ones (exit 0 vs. exit 1) before this was wired up in the dashboard.

## Testing

```bash
npm test          # run once
npm run test:watch  # re-run on change
npx tsc --noEmit  # type check
npm run lint
```

Tests use [Vitest](https://vitest.dev) and live next to the code they cover
(`lib/**/*.test.ts`). Scope is the pure decision logic — Band Readiness
scoring, AI criteria extraction and validation, band ranking, and input
formatting. They run without a database, a browser, or a network call (the
Gemini client is mocked), so the whole suite finishes in a few seconds.

Server actions and React components are **not** covered; they need a live
Supabase project or a DOM, which is a much heavier setup than the decision
logic they delegate to. Verifying those is still manual.
