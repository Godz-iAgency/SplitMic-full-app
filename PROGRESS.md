# SplitMic — Progress & Roadmap

_Austin-only music-industry connection platform for bands, venues, talent buyers, record labels, and festivals._

Last updated: **2026-07-13**

> **Note on the README:** `README.md` is stale — it still describes the app as "Phase 1 / Week 1"
> and lists finished features (photo upload, the readiness scoring engine, the real `/search` UI)
> as future work. Treat **this file** as the source of truth for status. The README should be
> rewritten separately.

---

## 1. Status at a glance

### ✅ Done (built, wired end-to-end, in production)

- **Auth** — Google OAuth + email/password (sign up, sign in, forgot/reset password).
- **Onboarding** — 3-step flow: player type → Google-Maps-validated Austin address → player-type-specific profile form (all 5 types).
- **Profiles** — full public/owner profile view, photo/video upload with cropping/compression, publish & unpublish, Band Readiness Score.
- **Discover / Search** — filter by type, genre, sort, text query; pagination; category tiles; Band Readiness scoring baked into band cards.
- **Marketplace / Opportunities** — post events & opportunities, band tagging on events (accept/decline/share-to-feed), respond/apply flow, full owner CRUD.
- **Connections & Messaging** — Connect requests, accept/decline, 1:1 DM threads, unread badges, inbox with Requests / Conversations tabs.
- **Admin console** — dashboard stats, user moderation (suspend/delete/publish), post moderation, connection audit, full action log.
- **Notifications (email)** — Resend transactional email for connection requests, post responses, and new messages. _(Already migrated off the old Supabase → n8n → Gmail webhook in commit `a56363e`.)_
- **PWA** — installable, custom install prompt, offline fallback page, service worker (production only).
- **Public landing page** — hero, features, how-it-works, player-type explainers, support/contact form.

### 🟡 Half-done / blocked on config (not code)

- **Email deliverability** — the code is complete, but transactional emails only reliably reach the Resend account owner's inbox until **`splitmic.com` is verified as a sending domain in Resend**. See §4.
- **Email links are generic** — every notification email links to `/inbox` rather than the specific thread/request/post that triggered it. Being fixed this round (§3, Workstream A).
- **Admin access model** — a single hardcoded email (`christopher@godz-iagency.com` in `lib/supabase/admin.ts`). Works, but adding a co-admin needs a code change + redeploy, not a UI toggle.

### ⛔ Not started (planned this round)

- **AI show-matching for talent buyers** (§3, Workstream B).
- **Open mic signups for venues** (§3, Workstream C).

### 🧹 Housekeeping / tech debt (not blocking)

- `README.md` and `.env.example` are out of date (`.env.example` is missing `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `SUPPORT_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`).
- `OPENROUTER_API_KEY` in the README is a dead reference (never used in code). `.env.local` also carries unused `OPENROUTER_API_KEY` and `XAI_API_KEY`.
- No automated tests anywhere (no test script, no test framework).
- No hard-delete cleanup job for expired `marketplace_posts` (they soft-expire and simply stop appearing).
- Search pagination is offset-based (`lib/supabase/search.ts:65`) — fine at current scale.

---

## 2. Decisions locked for this round

| # | Decision | Choice |
|---|----------|--------|
| 1 | AI provider for show-matching | **Gemini API** (`GEMINI_API_KEY` already present in `.env.local`) |
| 2 | AI matching depth | **Structured extraction → existing search filters.** No embeddings / vector DB for v1. |
| 3 | Open mic signup model | **Simple ordered list.** First-come-first-served; venue can **reorder** so whoever arrives first performs first, plus check-in. No time-slot picker in v1. |
| 4 | Email work | **Deep links to the specific thread/request/post**, plus **domain verification** as a mandatory ops task. Onboarding-complete email **parked** for later. |

---

## 3. Planned work

### Workstream A — Email deep links

**Goal:** notification emails link the user straight to the thing that happened, not the generic inbox.

**Where it lives today:** `lib/notifications/email.ts` (`notifyByEmail`) is called in 4 places:
- `app/inbox/actions.ts:127` — `message` (reply in an existing thread)
- `app/inbox/actions.ts:253` — `message` (first message after accept)
- `app/inbox/actions.ts:285` — `connection_request`
- `app/opportunities/actions.ts:463` — `post_response`

Every send currently hard-codes the CTA to `${APP_URL}/inbox` (both the text body and the HTML button in `renderHtml`).

**Deep-link targets (routes verified to exist):**

| Kind | Target route | Notes |
|------|--------------|-------|
| `message` | `/inbox/{threadId}` | `app/inbox/[threadId]/page.tsx` exists — direct to the conversation. |
| `connection_request` | `/inbox?tab=requests` | Requests tab (`searchParams.tab`, default is `requests`). |
| `post_response` | `/inbox?tab=requests` | It's a `connection_request` row with `related_post_id`; keep the accept/decline flow in the requests tab. |

**Changes:**
1. Extend `notifyByEmail` params to accept an optional `threadId` (for messages), and build the CTA URL per `kind` instead of always `/inbox`.
2. Thread the `threadId` through the two `message` call sites in `app/inbox/actions.ts` (both already have the thread in scope).
3. Update `renderHtml` / text body to use the per-kind URL.
4. No schema change.

---

### Workstream B — AI show-matching for talent buyers (Gemini)

**Goal:** a talent buyer describes the show they want in plain language; Gemini extracts structured criteria; we match against published band profiles and return a ranked shortlist the buyer can Connect with.

**Approach (locked):** structured extraction, **no embeddings**. Gemini's only job is `natural language → filter object`. Matching then runs through the existing profile data.

**What exists to build on:**
- `lib/supabase/search.ts` — `searchProfiles` + per-type detail fetchers. Band detail rows already expose rich fields: `genres`, `sound_description`, `set_length_minutes`, `typical_draw`, `largest_venue_capacity`, `member_count`, plus social reach.
- `lib/genres.ts` — the fixed genre taxonomy (constrain Gemini's genre output to these values).
- Connect flow (`components/inbox/ConnectButton.tsx`, `app/inbox/actions.ts`) — the "reach out" action already exists; the shortlist reuses it.

**New pieces:**
1. `lib/ai/gemini.ts` — thin Gemini client (server-only, reads `GEMINI_API_KEY`). Google `@google/generative-ai` SDK (new dependency).
2. `lib/ai/showMatch.ts` — prompt + structured-output schema mapping a description to `{ genres[], member_count?, min_draw?, keywords[] }`, constrained to real genre values. Best-effort: on failure fall back to plain search.
3. A server action + a talent-buyer-only UI entry point (e.g. `app/opportunities/match` or a panel on the buyer dashboard) that: takes the description → Gemini → runs an extended band query → returns ranked `SearchCard`s with a "why matched" line + Connect button.
4. **Note:** current `searchProfiles` supports only a single genre + name query. This feature needs richer band filtering (multiple genres via `overlaps`, numeric thresholds on `typical_draw` / `member_count`). Plan to add a dedicated `matchBands()` query rather than overloading `searchProfiles`.

**Gating:** talent-buyer player type only (check like the existing `isIndustryPlayerType` / posting-type guards).

---

### Workstream C — Open mic signups for venues

**Goal:** a venue posts an open mic; bands sign up on the platform; the venue gets a dashboard list of who's committed, can **reorder** it (arrival order = performance order), and check bands in.

**Approach (locked):** simple ordered list, no time slots.

**Schema (new migration `step8_open_mic.sql`):**
- Reuse the marketplace concept but keep signups in a dedicated table. Two options — **recommended:** add `'open_mic'` to `marketplace_posts.post_type` (relax the `event_requires_date` / `opportunity_requires_open_until` CHECK constraints to allow the new type, add an `open_mic_requires_date` check), so open mics show in the existing Feed for free.
- New table `open_mic_signups`:
  - `id`, `post_id → marketplace_posts(id)`, `band_profile_id → profiles(id)`, `band_user_id → users(id)`
  - `sort_order INT` (venue-controlled ordering; default = signup order)
  - `status` — `signed_up` / `checked_in` / `no_show`
  - `created_at`, unique `(post_id, band_profile_id)` to block double signup
  - RLS: band inserts/deletes own signup; venue (post owner) reads all + updates `sort_order` / `status`; bands read the roster for a post they're on.

**App pieces:**
- Band-facing: a "Sign up" button on an open-mic post (bands only).
- Venue-facing dashboard view: roster list with drag-reorder + check-in toggles (post owner only). Likely `app/opportunities/[id]/roster` or a panel on the post detail page.
- Reuse `components/opportunities/*` patterns for the post creation form (add the open-mic type).

---

## 4. Operational checklist (outside the code)

- [ ] **Verify `splitmic.com` in Resend** as a sending domain (SPF/DKIM DNS records), then set `NOTIFY_FROM_EMAIL="SplitMic <notify@splitmic.com>"` in the deploy env. Until then, real users won't reliably receive notification emails.
- [ ] Confirm `GEMINI_API_KEY` in `.env.local` is a working key with the Generative Language API enabled before wiring Workstream B.
- [ ] Update `.env.example` to include every required var (Resend + app URL group).
- [ ] Confirm `step2` / `step3` schema (no migration files exist for them — were they applied directly in the Supabase dashboard?). Worth capturing for a reproducible schema history.

---

## 5. Suggested build order

1. **Workstream A** (email deep links) — smallest, no schema change, immediate UX win.
2. **Workstream C** (open mic) — self-contained feature, one migration + venue/band UI.
3. **Workstream B** (AI matching) — new external dependency (Gemini), needs the extended band query; do last so it can lean on stable search code.
4. Housekeeping: README rewrite + `.env.example` fix (can slot in anytime).
