# SplitMic

Austin-only music-industry network connecting bands, venues, talent buyers,
record labels, and festivals on one platform.

For current status, in-flight work, and the decision log, see
[`PROGRESS.md`](PROGRESS.md). For the database schema history (including some
unused legacy tables), see [`migrations/SCHEMA_HISTORY.md`](migrations/SCHEMA_HISTORY.md).
This file covers setup and a tour of the codebase.

## Stack

- Next.js 14 (App Router, TypeScript, server actions)
- Supabase (Postgres, Auth, Storage, Row Level Security)
- Tailwind CSS
- Google Maps Geocoding API (Austin address validation during onboarding)
- Google Gemini API (AI show-matching for talent buyers)
- Resend (transactional email)

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
  inbox/                  DM threads + connection requests
  match/                  AI show-matching (talent buyers only)
  onboarding/              3-step signup flow (player type → address → profile)
  opportunities/          Marketplace: events, opportunities, open mic rosters
  profile/                Public profile view + owner edit flow
  search/                 Discover (browse/filter published profiles)
  support/                Contact form

components/               One folder per feature area, mirrors app/
lib/
  ai/                     Gemini client + show-matching extraction
  scoring/                Band Readiness Score
  supabase/               Server-side query/action helpers (search, messaging, marketplace, profile)
  notifications/          Transactional email

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
