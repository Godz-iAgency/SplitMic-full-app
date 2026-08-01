# SplitMic — Progress & Roadmap

_Austin-only music-industry connection platform for bands, venues, talent buyers, record labels, and festivals._

Last updated: **2026-08-01**

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

### 🟡 Half-done / blocked on config (not code)

- **Email deliverability** — the code is complete, but transactional emails only reliably reach the Resend account owner's inbox until **`splitmic.com` is verified as a sending domain in Resend**. See §3.
- **Admin access model** — a single hardcoded email allowlist (`lib/supabase/admin.ts`). Works, but adding a co-admin needs a code change + redeploy, not a UI toggle.

### ⛔ Not started

_(nothing outstanding from the original round)_

### 🧪 Tests

Vitest, 67 tests across `lib/**/*.test.ts`, run with `npm test`. Covers the
pure decision logic: Band Readiness scoring, AI criteria extraction and
validation (Gemini mocked), band ranking, and input formatting. No database,
browser, or network needed.

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

---

## 3. Operational checklist (outside the code)

- [ ] **Verify `splitmic.com` in Resend** as a sending domain (SPF/DKIM DNS records), then set `NOTIFY_FROM_EMAIL="SplitMic <notify@splitmic.com>"` in the deploy env. Until then, real users won't reliably receive notification emails.
- [x] Confirmed `GEMINI_API_KEY` is a working key with the Generative Language API enabled.
- [x] `.env.example` includes every required var.
- [x] `step2`/`step3` schema history documented.

---

## 4. Next up

Roughly in order of size:

1. **Set `CRON_SECRET` in the deploy env** — until it's set, the cleanup endpoint refuses to run (by design). Generate with `openssl rand -hex 32`.
2. **Resend domain verification** — ops task, not code, but blocks real email delivery.
3. **"Shows played" history on profiles** — the Snapchat-Memories idea: a permanent, browsable record of past shows on a band/venue profile, independent of the post's lifecycle. Real product value (social proof for bands, activity signal for venues) and the data exists today; needs its own design.
4. **Admin access model** — move off the hardcoded allowlist if a second admin is ever needed.
5. **Widen test coverage** — the natural next targets are `lib/supabase/marketplace.ts` (post expiry/visibility rules) and `lib/pendingProfile.ts` (localStorage validation), both close to pure.
6. **Audit fetch caching on the cookie-based Supabase client** — the service-role client had a real Next.js fetch-cache staleness bug (fixed in `lib/supabase/service.ts`). `lib/supabase/server.ts` was not audited for the same issue.
