# Schema history: the step2 / step3 gap

`migrations/` jumps from `step1_field_additions.sql` (2026-05-04) straight to
`step4_marketplace.sql` (2026-05-10). No `step2` or `step3` file exists. This
was flagged in `PROGRESS.md` as unconfirmed. Findings below, from introspecting
the live database directly (there is no local Postgres to diff against — this
is reconstructed from what actually exists today).

## What step2 / step3 most likely were

The live database has seven tables that are **not created by any file in
`migrations/`** and are **not read or written anywhere in the app code**
(checked via `.from("<table>")` across the whole codebase):

| Table | Looks like it was for |
|---|---|
| `profile_follows` | A follow/follower graph between profiles |
| `booking_requests` | A direct booking-request flow (separate from `connection_requests`) |
| `reviews` | Ratings tied to `booking_requests` |
| `conversations` | A messaging table, superseded by `message_threads` + `dm_messages` in step5 |
| `notifications` | An in-app notification feed, superseded by email notifications (`lib/notifications/email.ts`) |
| `analytics_events` | Generic event logging |
| `saved_searches` | Saved Discover filters |

Given the dates (step1 on the 4th, step4 on the 10th) and that every one of
these tables was later superseded by a different, actually-shipped mechanism
(`connection_requests`/`message_threads` instead of `booking_requests`/
`conversations`/`reviews`, email instead of `notifications`), the most
plausible read is: **step2 and step3 were an earlier design for
connections/messaging/social features, built directly in the Supabase
dashboard, then abandoned mid-build** when the current `connection_requests` →
`message_threads` model (step5) and marketplace model (step4) were designed
instead. The tables were never dropped, just never wired up or referenced
again.

`profiles` also carries three columns no app code reads or writes:
`location`, `search_vector`, `welcome_email_sent`. These may be maintained by
a database trigger or generated column not visible from the app side (e.g. a
geography point derived from the address fields, a tsvector for full-text
search). Confirm in the Supabase dashboard before assuming they're dead —
unlike the seven tables above, a trigger-maintained column can be "in use"
without ever appearing in a `grep`.

## What this means practically

- **Nothing to fix.** The app doesn't depend on any of this, so there's no
  bug here, just untracked schema.
- **Not deleted as part of this task.** Dropping unused tables is a separate,
  deliberate decision (data loss if the reconstruction above is wrong about
  them being dead) — flagging for the user to decide, not doing it here.
- **A from-scratch rebuild** (`step1` → `step4` → ... in order) will produce
  a working app — it just won't recreate these seven tables or the three
  orphaned `profiles` columns. Since nothing reads them, that's fine.

## Recommendation

If a co-admin or a future migration ever needs a clean base to work from,
either:
1. Confirm with the Supabase dashboard that `location`/`search_vector`/
   `welcome_email_sent` are genuinely unused, then drop all ten items in one
   `step10_drop_unused_schema.sql`, or
2. Leave as-is — they cost nothing at this scale and this file is now the
   record of why they exist.
