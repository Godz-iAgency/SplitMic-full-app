# SplitMic — Progress & Roadmap

_Austin-only music-industry connection platform for bands, venues, talent buyers, record labels, and festivals._

Last updated: **2026-08-09**

For setup and a codebase tour, see [`README.md`](README.md). For the database
schema gap (some legacy tables with no migration file), see
[`migrations/SCHEMA_HISTORY.md`](migrations/SCHEMA_HISTORY.md).

---

## 1. Status at a glance

### ✅ Done (built, wired end-to-end)

- **Auth** — Google OAuth + email/password (sign up, sign in, forgot/reset password).
- **Onboarding** — 3-step flow: player type → Google-Maps-validated Austin address → player-type-specific profile form (all 5 types). Photos/video happen immediately after on `/profile/edit`, which auto-publishes on save. A pre-signup mini profile builder (genres + one scale question) on the landing page carries answers through signup so onboarding starts pre-filled.
- **Profiles** — full public/owner profile view, photo/video upload with cropping/compression, Band Readiness Score, one-click Publish/Unpublish toggle at the top of the page (in addition to the existing bottom-of-page publish cards).
- **Discover / Search** — filter by type, genre, sort, text query; pagination; category tiles; Band Readiness scoring baked into band cards.
- **Marketplace / Opportunities** — post events, opportunities, and open mics; band tagging on events (accept/decline/share-to-feed); respond/apply flow; full owner CRUD.
- **Open mic signups** — bands sign up for a venue's open mic; venue gets a roster dashboard, can reorder the running order, and check bands in/mark no-show (`app/opportunities/[id]/roster`, `signUpForOpenMic`/`reorderOpenMicSignup`/`setOpenMicSignupStatus` in `app/opportunities/actions.ts`).
- **Connections & Messaging** — Connect requests, accept/decline, 1:1 DM threads, unread badges, inbox with Requests / Conversations tabs.
- **AI show-matching for talent buyers** (`/match`, talent-buyer accounts only) — plain-English show description → Gemini extracts genre/draw/band-size/vibe criteria → ranked against published bands using our own data. Gemini never ranks or sees band data directly; a "why matched" line and Connect button sit on every result. Degrades to ranking by profile completeness if Gemini is unreachable, with that stated in the UI. See `lib/ai/`, `lib/supabase/matchBands.ts`, `app/match/`.
- **Admin console** — dashboard stats, user moderation (suspend/delete/publish), post moderation, connection audit, full action log.
- **Notifications (email)** — Resend transactional email for connection requests, post responses, and new messages, each deep-linking to the specific thread/request rather than a generic inbox (`buildCtaPath` in `lib/notifications/email.ts`).
- **Scheduled cleanup of expired posts** — `GET /api/cron/cleanup-posts`, secret-guarded, dry-run supported, batched, idempotent. Posts soft-expire from the Feed after 7 days (unchanged) and are hard-deleted a **year** later. The long window is deliberate: `event_band_tags` and `open_mic_signups` cascade with the post, so it is the only place a show's history lives. Retention under 30 days is rejected outright. Scheduled weekly via `vercel.json`; portable to any scheduler.
- **PWA** — installable, custom install prompt, offline fallback page, service worker (production only).
- **Public landing page** — hero, features, how-it-works, player-type explainers, support/contact form.
- **Business directory (`/directory`)** — public, no-login guide to Austin's music industry across 8 categories, one indexable page each at `/directory/<slug>`. 584 businesses imported from a scraped CSV via an admin screen (`/admin/directory`) with a dry-run mode. Tiered listings (standard/featured/spotlight) drive both sort order and visual treatment, so it reads as a curated guide rather than a dump. Built-in outreach tracker (status + notes + last-contacted, including `do_not_contact`) — this is the tool the 584-business outreach campaign actually runs from. Scraped listings can be linked to real SplitMic profiles as businesses sign up (`claimed_profile_id`), which is the conversion path. Re-import is idempotent and never overwrites hand-set tiers or outreach state (regression-tested). Scraped emails and the outreach pipeline are blocked from the public role by column grants, not just RLS. `ItemList`/`BreadcrumbList`/`FAQPage` JSON-LD per category. See `lib/directory/`, `app/directory/`, `app/admin/directory/`.
- **Live events (`/live`)** — public, no-login page listing Austin live music happening today/this week, aimed at "Austin live music" search traffic. Events scraped daily from Do512 via Firecrawl (`lib/events/do512.ts`), cross-referenced against SplitMic's own published bands/venues so a card can link straight to a real profile (`lib/events/matching.ts`), stored in `live_events` (public read, service-role-only writes). Each event links out to Google Maps directions and an Uber deep link, no API key needed for either. Page carries a 10-question FAQ and `MusicEvent`/`FAQPage` JSON-LD built from the same content it renders. Scheduled via `GET /api/cron/sync-events`, same bearer-secret pattern as cleanup-posts (now shared via `lib/http/cronAuth.ts`), fails closed if unset, skips its own deactivation step on a partial scrape so a transient Firecrawl hiccup never wipes real listings.

### 🟡 Half-done / blocked on config (not code)

- **Email deliverability** — the code is complete, but transactional emails only reliably reach the Resend account owner's inbox until **`splitmic.com` is verified as a sending domain in Resend**. See §3.
- **Admin access model** — a single hardcoded email allowlist (`lib/supabase/admin.ts`). Works, but adding a co-admin needs a code change + redeploy, not a UI toggle.

### ⛔ Not started

_(nothing outstanding from the original round)_

### 🧪 Tests

Vitest, 254 tests across `lib/**/*.test.ts`, run with `npm test`. Covers the
pure decision logic: Band Readiness scoring, AI criteria extraction and
validation (Gemini mocked), band ranking, input formatting, marketplace-post
cleanup, the live-events pipeline (Do512 mapping/timezone conversion, profile
matching, sync upsert/deactivate logic), the directory CSV parser and importer,
and every JSON-LD builder. Firecrawl and Supabase are mocked throughout — no
database, browser, or network needed.

`lib/directory/realCsv.test.ts` is the exception worth knowing about: it runs
the actual scraped CSV through the mapper and asserts the exact expected output
(584 rows, 296 venues, 11 phone numbers, no duplicate keys). It skips itself
when the gitignored CSV isn't present, so it's a local-only safety net.

Both bugs found while building show-matching have regression tests, and both
were verified to actually fail when the fix is reverted:
- Genre must gate the shortlist (a band matching none of the requested genres is out, however well it scores elsewhere).
- The smallest draw bucket is treated as no constraint (every band clears it, so scoring it was noise).

Server actions and React components are not covered — they need a live
Supabase project or a DOM. Still verified manually.

### 🧹 Housekeeping (resolved this round)

- ~~`README.md` / `.env.example` out of date~~ — both rewritten to match actual state.
- ~~Dead `OPENROUTER_API_KEY` / `XAI_API_KEY`~~ — removed from `.env.local`; never referenced in code. (`XAI_API_KEY`'s value was a `gsk_`-prefixed Groq key under the wrong name, not an xAI credential — worth knowing if anyone goes looking for it.)
- ~~`step2`/`step3` schema gap unconfirmed~~ — documented in `migrations/SCHEMA_HISTORY.md`: 7 unused tables + 3 orphaned `profiles` columns, none read by app code, most likely an abandoned early connections/messaging design superseded by `connection_requests` + `message_threads`.

### Still true, not urgent

- Search pagination is offset-based (`lib/supabase/search.ts`) — fine at current scale.

---

## 2. Decisions locked (still in effect)

| # | Decision | Choice |
|---|----------|--------|
| 1 | AI provider for show-matching | **Gemini API** (`gemini-2.5-flash`, plain `fetch` against the REST API, no SDK dependency) |
| 2 | AI matching depth | **Structured extraction → existing search filters.** No embeddings / vector DB. |
| 3 | Open mic signup model | **Simple ordered list.** First-come-first-served; venue can reorder + check in. No time-slot picker. |
| 4 | Email work | **Deep links to the specific thread/request/post.** Domain verification remains a manual ops task. |
| 5 | AI fallback provider | **None.** Considered wiring `OPENROUTER_API_KEY` as a backup LLM if Gemini is down; decided the existing graceful degrade (rank by profile completeness, tell the user) already covers it, and a second provider isn't worth the added surface for a rare failure mode. |
| 6 | Post retention | **1 year** past soft expiry, then hard delete. 90 days was considered and rejected: at current scale the storage difference is nil, and a shorter window would destroy show history before a future "shows played" profile feature could ever use it. Easy to tighten later; impossible to un-delete. |
| 7 | Show history storage | **Stays on the post for now.** There is no separate archive — `event_band_tags` / `open_mic_signups` hang off `marketplace_posts` and cascade with it. A real "Memories"-style permanent history on band/venue profiles (surviving post deletion) is a **separate future feature**, not part of cleanup. |
| 8 | Live-events data source | **Do512, not Bandsintown**, despite the feature originally being scoped around Bandsintown. Bandsintown's self-serve API is artist-scoped (`GET /artists/{name}/events`), not city-scoped — it can only answer "what shows does band X have," not "what's happening in Austin tonight," so it can't drive a real citywide feed. Do512 runs an actual dedicated Austin live-music-today page. Bandsintown may still be worth adding later, narrowly, as a "your upcoming shows" block on an individual band's own profile — not as the /live feed's source. |
| 9 | Directory re-import safety | **Partitioned insert / update-scraped-fields-only / unchanged, never a blanket upsert.** A plain upsert would wipe hand-set tiers and the entire outreach pipeline on every re-run — the highest-risk defect this feature could have shipped. Guarded by a test that fails if any curation field enters an update payload. |
| 10 | Directory email exposure | **Column-level `GRANT`, not just RLS.** RLS is row-level; the public anon key can query PostgREST directly for any column of a readable row, which would expose 445 scraped contact addresses and the private outreach notes. `migrations/step11_business_directory.sql` revokes the blanket grant and re-grants only public-facing columns. Don't remove that block. |
| 11 | Directory route shape | **`/directory/<category>` real paths**, not `?category=`. Eight separate indexable pages each targeting its own search term beats one page with query params, which search engines treat as near-duplicates. |

---

## 3. Operational checklist (outside the code)

- [ ] **Verify `splitmic.com` in Resend** as a sending domain (SPF/DKIM DNS records), then set `NOTIFY_FROM_EMAIL="SplitMic <notify@splitmic.com>"` in the deploy env. Until then, real users won't reliably receive notification emails.
- [ ] **Run `migrations/step10_live_events.sql`** in the Supabase SQL editor and set `FIRECRAWL_API_KEY` in the deploy env — until both are done, `/live` renders (empty) but `sync-events` has nothing to write to / no way to scrape.
- [ ] **Import the directory CSV** — `/admin/directory` → Dry run (expect 584 to insert; 296 venues, 77 labels, 76 talent buyers, 44 bands, 40 festivals, 25 instrument rental, 21 rehearsal studios, 5 backline) → Import now. Run from `npm run dev` locally so the gitignored CSV is on disk. Then set 10-20 anchor businesses to Featured/Spotlight.
- [ ] **Submit `splitmic.com/sitemap.xml`** to Google Search Console — `app/sitemap.ts` and `app/robots.ts` now exist and cover `/`, `/live`, `/directory`, and the 8 category pages.
- [x] `migrations/step11_business_directory.sql` run — `directory_businesses` exists, 0 rows.
- [x] Confirmed `GEMINI_API_KEY` is a working key with the Generative Language API enabled.
- [x] `.env.example` includes every required var.
- [x] `step2`/`step3` schema history documented.

---

## 4. Next up

Roughly in order of size:

1. **Set `CRON_SECRET` in the deploy env** — until it's set, the cleanup endpoint refuses to run (by design). Generate with `openssl rand -hex 32`.
2. **Resend domain verification** — ops task, not code, but blocks real email delivery.
3. **Expand the Bands directory category** — 44 rows vs. 296 venues, because Austin Band List's ~700 names mostly lack contact info on the listing page and needed per-band verification. Everything else in the directory is comfortably populated; this one category looks thin until a follow-up scrape runs.
4. **Import the directory CSV into a `claimed` flow** — right now linking a scraped listing to a real profile is a manual admin action (paste a profile ID). A self-serve "claim this listing" flow for business owners is the obvious next step once outreach starts converting.
5. **"Shows played" history on profiles** — the Snapchat-Memories idea: a permanent, browsable record of past shows on a band/venue profile, independent of the post's lifecycle. Real product value (social proof for bands, activity signal for venues) and the data exists today; needs its own design.
6. **Admin access model** — move off the hardcoded allowlist if a second admin is ever needed.
7. **Widen test coverage** — the natural next targets are `lib/supabase/marketplace.ts` (post expiry/visibility rules) and `lib/pendingProfile.ts` (localStorage validation), both close to pure.
8. **Audit fetch caching on the cookie-based Supabase client** — the service-role client had a real Next.js fetch-cache staleness bug (fixed in `lib/supabase/service.ts`). `lib/supabase/server.ts` was not audited for the same issue.
