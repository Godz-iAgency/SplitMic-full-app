# SplitMic

Austin-only music-industry network connecting bands, venues, talent buyers,
record labels, and festivals on one platform.

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
- Google Maps Geocoding API (Austin address validation during onboarding)
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
GEMINI_API_KEY=                  # AI show-matching; needs the Generative Language API enabled
FIRECRAWL_API_KEY=               # Scrapes Do512 for the /live page's daily sync job
CRON_SECRET=                     # Shared by both scheduled endpoints (see "Scheduled jobs" below)
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
  events/                 Do512 scraping, event sync, profile matching, JSON-LD (see "Live events" below)
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

- **Onboarding** — 3 steps: player type → Google-Maps-validated Austin address → player-type-specific profile form. Immediately after, the user lands on `/profile/edit` to add photos/video, which auto-publishes the profile on save.
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
Events come from Do512, scraped daily via Firecrawl (`lib/events/do512.ts`)
by the `sync-events` cron job below, matched against SplitMic's own
published band/venue profiles where possible (`lib/events/matching.ts`), and
stored in `live_events` (public read, service-role-only writes — see
`migrations/step10_live_events.sql`). The page also carries a 10-question FAQ
and JSON-LD structured data (`MusicEvent` per show, `FAQPage`) built from the
same content it renders, so search engines and AI answer engines see exactly
what a visitor sees.

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

## Scheduled jobs

Both jobs below share one `CRON_SECRET` and the same auth pattern
(`lib/http/cronAuth.ts`): `Authorization: Bearer $CRON_SECRET`, fails closed
(never runs unauthenticated) if the secret is unset. `vercel.json` schedules
both; on any other host, point that host's scheduler at the same URLs with
the same header.

```bash
# Live events — dry run (report only, writes nothing)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/sync-events?dryRun=1"
```

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
