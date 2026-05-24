# SplitMic — Phase 1 / Week 1

Austin-only music ecosystem. Week 1 ships **Google OAuth + multi-step onboarding** for all 5 player types.

## Stack

- Next.js 14 (App Router, TypeScript)
- Supabase Auth (Google OAuth) + Postgres
- Tailwind CSS
- Google Maps Geocoding API (Austin address validation)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

## Env vars (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
OPENROUTER_API_KEY=
```

> ⚠️ **Never commit `.env.local`.** Rotate any credentials that have been pasted into a chat or document.

## Supabase setup checklist

1. **Auth → Providers → Google**: enable Google. Use the same client ID / secret as `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
2. **Auth → URL Configuration**: add the redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://<your-vercel-domain>/auth/callback` (Week 5)
3. **Auth → URL Configuration → Site URL**: set to `http://localhost:3000` for now.
4. **RLS**: every table this app writes to (`users`, `bands`, `venues`, `talent_buyers`, `record_labels`, `festivals`) needs an authenticated insert/update policy keyed on `auth.uid() = user_id` (or `id` for `users`).

## Expected schema (Week 1)

The app writes to these columns. If any column name in your existing schema differs, update the corresponding insert in `components/onboarding/OnboardingFlow.tsx` (`buildProfileRow`) and `app/auth/callback/route.ts`.

### `users`
- `id` (uuid, PK, references `auth.users.id`)
- `email` (text)
- `google_auth_id` (text)
- `full_name` (text)
- `phone_number` (text)
- `avatar_url` (text)
- `player_type` (text — one of `band`, `venue`, `talent_buyer`, `record_label`, `festival`)
- `street_address` (text)
- `address_line_2` (text, nullable)
- `city` (text — always `Austin`)
- `state` (text — always `TX`)
- `zip_code` (text — 5-digit, must be 78701–78799)
- `profile_completed` (bool, default false)
- `updated_at` (timestamptz)

### Player profile tables
Each row is keyed on `user_id` (uuid, unique, references `users.id`) and shares the common fields:
`full_name`, `phone_number`, `bio`, `instagram_handle`, `instagram_followers`.

- `bands`: `+ band_name, genres (text[]), member_count, sound_description, set_length_minutes`
- `venues`: `+ venue_name, capacity, genres_hosted (text[]), shows_per_week, booking_contact_name, booking_contact_email`
- `talent_buyers`: `+ company_name, company_type, genres_focus (text[]), typical_booking_fee, booking_radius_miles`
- `record_labels`: `+ label_name, label_type, genres_focus (text[]), artists_signed`
- `festivals`: `+ festival_name, festival_start_date, festival_end_date, genres_featured (text[]), expected_attendance, total_band_slots`

## Routes

- `/` — bounces user based on session + profile state
- `/login` — Google OAuth (signed-in users with completed profile go to `/search`)
- `/auth/callback` — Supabase OAuth code exchange + first-time `users` row insert
- `/onboarding` — 3 steps: player type → Austin address → profile form (Week 2 will add a 4th: photos)
- `/api/validate-address` — POST `{ address }` → Google Maps geocode + Austin/ZIP check
- `/search` — Week 1 placeholder welcome page with logout

## Austin address validation

The geocoder must return `locality = Austin`, `administrative_area_level_1 = TX`, `country = US`, and a `postal_code` in `78701–78799`. Anything else is rejected with a user-facing error.

## Week 1 → Week 2 handoff

- Photo / video upload (Step 4 of onboarding, currently shown as locked).
- Austin band scoring engine.
- Real `/search` UI.
