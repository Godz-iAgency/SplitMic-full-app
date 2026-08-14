# SplitMic — Progress & Roadmap

_Austin-only music-industry connection platform for bands, venues, talent buyers, record labels, and festivals._

Last updated: **2026-08-11**

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
- **Business directory (`/directory`)** — public, no-login guide to Austin's music industry across 8 categories, one indexable page each at `/directory/<slug>`. Cards carry each business's Open Graph preview photo or a website screenshot (or a category-themed fallback until either is captured), a favicon-derived logo, a clickable subcategory chip that refilters, and Website/Directions/Reviews/Share actions — Directions and Reviews are Google Maps searches by business name, so they need no stored address. Filter bar has a live result count and a subcategory dropdown populated from the data. 584 businesses imported from a scraped CSV via an admin screen (`/admin/directory`) with a dry-run mode. Tiered listings (standard/featured/spotlight) drive both sort order and visual treatment, so it reads as a curated guide rather than a dump. Built-in outreach tracker (status + notes + last-contacted, including `do_not_contact`) — this is the tool the 584-business outreach campaign actually runs from. Scraped listings can be linked to real SplitMic profiles as businesses sign up (`claimed_profile_id`), which is the conversion path. Re-import is idempotent and never overwrites hand-set tiers or outreach state (regression-tested). Scraped emails and the outreach pipeline are blocked from the public role by column grants, not just RLS. `ItemList`/`BreadcrumbList`/`FAQPage` JSON-LD per category. A free website liveness check (`lib/directory/websiteCheck.ts`) confirms each listing's site still responds — only a non-resolving domain, refused connection, or hard 404/410 counts as dead, so a flaky moment never wrongly flags a real business; the admin panel can auto-run the check across every remaining listing and then hide (not delete) the confirmed-dead ones, reversible from the row toggle. See `lib/directory/`, `app/directory/`, `app/admin/directory/`.
- **Live events (`/live`)** — public, no-login page listing Austin live music happening today/this week, aimed at "Austin live music" search traffic. Events scraped daily from Do512 via Firecrawl (`lib/events/do512.ts`), cross-referenced against SplitMic's own published bands/venues so a card can link straight to a real profile (`lib/events/matching.ts`), stored in `live_events` (public read, service-role-only writes). Each event links out to Google Maps directions and an Uber deep link, no API key needed for either. Page carries a 10-question FAQ and `MusicEvent`/`FAQPage` JSON-LD built from the same content it renders. Scheduled via `GET /api/cron/sync-events`, same bearer-secret pattern as cleanup-posts (now shared via `lib/http/cronAuth.ts`), fails closed if unset, skips its own deactivation step on a partial scrape so a transient Firecrawl hiccup never wipes real listings.

### 🟡 Half-done / blocked on config (not code)

- **Email deliverability** — the code is complete, but transactional emails only reliably reach the Resend account owner's inbox until **`splitmic.com` is verified as a sending domain in Resend**. See §3.
- **Admin access model** — a single hardcoded email allowlist (`lib/supabase/admin.ts`). Works, but adding a co-admin needs a code change + redeploy, not a UI toggle.

### ⛔ Not started

_(nothing outstanding from the original round)_

### 🧪 Tests

Vitest, 396 tests across `lib/**/*.test.ts`, run with `npm test`. Covers the
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
| 12 | Directory card imagery | **Three sources, tried in order: Open Graph image → Firecrawl website screenshot → brand gradient.** The scrape captured no images at all. All three are free — a Google Places photo pipeline (a real venue shot) was built and then removed: its API is billed, and its photo URLs expire and need periodic re-fetching, which contradicts a one-time backfill. The OG image is each business's own link-preview photo, pulled with a plain fetch, no key, no cost. `migrations/step13_directory_places.sql` and its `places_*`/`place_photo_*` columns are left in place unused rather than dropped — same treatment as the step2/step3 schema gap. Logos are separate — derived from each site's favicon at render time, nothing stored. Both remaining photo pipelines are batched and resumable; a row is never re-attempted once checked. |
| 13 | Page titles vs. the "Austin live music" keyword | **`/live` = "Austin Live Music Tonight", `/directory` = "Austin Live Music Directory".** Titling both plainly "Austin Live Music" (as first requested) would have had them compete for one phrase and split the ranking signal. Both carry the keyword against different intent instead. |
| 14a | Trusting LLM-extracted scrape output | **Never trust extraction from a page that didn't return 2xx.** Found live: Do512's `/this-week` began returning 500, Firecrawl scraped the error page anyway, and the LLM invented well-formed concerts to satisfy the schema — Taylor Swift at MetLife Stadium, Billie Eilish at United Center, 2023 dates. Nothing downstream could tell those from real rows. Two guards now: `scrapeDo512Events` rejects any scrape whose `metadata.statusCode` isn't 2xx, and `mapEventToRow` rejects dates more than `MAX_EVENT_DAYS_AHEAD` (60) out, since a "today"/"this weekend" listing can't legitimately contain one. Both are regression-tested. The lesson generalizes to any future LLM extraction: a schema-shaped response is not evidence the source had data. |
| 14a-2 | "Today" boundary for /live | **9am-to-9am Chicago cycle, not midnight-to-midnight.** A show that started at 8pm was disappearing from "Tonight" the instant its start time passed, because `getUpcomingEvents` filtered `event_datetime >= now`. Fixed two ways: `isToday`/`formatEventDayLabel` (`lib/events/time.ts`) now key off a cycle that starts at 9am Chicago, so a show stays "Tonight" all night and only rolls over once the *next* day's sync has run, not at the clock's midnight; and the query's lower bound widened to a rolling 26-hour lookback so those events stay in the fetched result set at all, with the actual today/not-today call still made by the cycle-aware function downstream. Nothing is deleted to "erase" a stale day — old events simply age out of both the display cycle and the 26h query window on their own. Also caught while wiring this up: `vercel.json`'s cron was `0 9 * * *`, which is 9am **UTC** (3-4am Central) — not 9am Austin time as the schedule's own mental model assumed. Moved to `0 14 * * *` (9am CDT / 8am CST); a single static Vercel cron can't track DST exactly, and a one-hour seasonal drift isn't worth a second cron entry plus a day-of-year guard to close. |
| 14b | Intro video storage | **A pasted link embedded in an iframe, not an upload.** The old flow put a ≤30s/≤50MB clip in Supabase Storage, which capped every intro at 30 seconds and cost storage per profile, while most users already host their music video somewhere better. `profiles.intro_video_url` holds the raw pasted link; `lib/media/videoEmbed.ts` resolves it to an embed URL at render time (so the resolver can change with no data migration). Provider **allowlist**, not "iframe anything": (1) most sites refuse to be framed at all — Instagram, TikTok, and Facebook all block it, so a generic iframe renders a blank box; (2) profiles are public and user-controlled, so an arbitrary iframe would let anyone render a page of their choosing on splitmic.com — e.g. a fake SplitMic login form — which is a phishing vector no visitor could detect. YouTube (via youtube-nocookie), Vimeo, Loom, SoundCloud, Spotify, and Google Drive cover every real video platform. **A direct link to a video file (.mp4/.webm/.m4v/.mov/.ogv) is accepted from _any_ host**, because it renders in a native `<video>` element rather than an iframe — media bytes can't render HTML or run scripts, so the impersonation risk that motivates the allowlist simply doesn't exist for that case. That distinction (`VideoEmbed.kind` — `"iframe"` vs `"file"`) is the actual security boundary, not the host list. Dropbox share links are rewritten to serve the raw file and then travel the file path. http file links are rejected with an explanation, since a browser blocks mixed content and would otherwise render an empty player. Old `profile_media` rows with `kind = 'video'` are left in place, unread, rather than deleted. |
| 14 | Removing dead directory listings | **Soft-deactivate (`is_active = false`), not `DELETE`.** A free website check (`lib/directory/websiteCheck.ts`) classifies each listing `live`/`dead`/`uncertain`; only a non-resolving domain, refused connection, or hard 404/410 counts as `dead` — a timeout, TLS error, 5xx, or 403 stays `uncertain` rather than risk mislabeling a real, still-open business as gone. "Hide dead listings" in `/admin/directory` uses the same reversible `is_active` flag as the per-row toggle, not a permanent delete, so a business that gets its site back up can be restored with one click instead of a re-import. |

---

## 3. Operational checklist (outside the code)

- [ ] **Verify `splitmic.com` in Resend** as a sending domain (SPF/DKIM DNS records), then set `NOTIFY_FROM_EMAIL="SplitMic <notify@splitmic.com>"` in the deploy env. Until then, real users won't reliably receive notification emails.
- [ ] **Run `migrations/step10_live_events.sql`** in the Supabase SQL editor and set `FIRECRAWL_API_KEY` in the deploy env — until both are done, `/live` renders (empty) but `sync-events` has nothing to write to / no way to scrape.
- [ ] **Run `migrations/step14_directory_og_image.sql`** in the Supabase SQL editor — **blocking**: without this, `/directory` and every category page render empty (the count query still works, but the card-data query errors on the missing `og_image_url` column and the page silently falls back to its empty state). Confirmed locally: `screenshot_url` and the unused `place_photo_url` both already exist in the live DB; only this one is missing.
- [ ] **Find photos (free)** — `/admin/directory` → "Find photos" panel, in batches. No cost, no key. Cards fall back to a website screenshot when a business has no Open Graph image.
- [ ] **Capture listing screenshots** — `/admin/directory` → "Generate screenshots", in batches. One Firecrawl credit per listing attempted; ~505 listings have websites. Only a fallback now: cards prefer the free Open Graph image when one exists.
- [ ] **Run `migrations/step16_profile_intro_video_url.sql`** — **blocking, run before deploying**: the profile page selects `intro_video_url`, and until the column exists that query errors and every profile page 404s. Purely additive, so it's safe to run against the currently-deployed code first.
- [ ] **Run `migrations/step15_directory_website_check.sql`** in the Supabase SQL editor — adds the `website_status`/`website_check_reason`/`website_checked_at` columns the new "Website check" panel needs. Without it the panel's queries error and the section just won't show useful counts.
- [ ] **Check websites (free)** — `/admin/directory` → "Website check" panel → "Auto-check all" to run it against every listing in one sitting (no cost, no key), then review the confirmed-dead list before clicking "Hide N dead listings."
- [ ] **Set 10-20 anchor businesses to Featured/Spotlight** in `/admin/directory` — the "make it look legit before selling placement" step.
- [x] Directory CSV imported — 584 rows (296 venues, 77 labels, 76 talent buyers, 44 bands, 40 festivals, 25 instrument rental, 21 rehearsal studios, 5 backline).
- [x] `migrations/step12_directory_media.sql` run — screenshot columns exist.
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
