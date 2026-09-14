# SplitMic audit — 2026-09-14

Local changes only. Nothing committed, pushed, deployed, or migrated. No new
dependencies. `.env.local` was not opened or edited. The normal Next.js dev
server loads its own environment when running; no credential values were
requested or printed.

## Prioritized findings

| Priority | Finding and impact | Disposition |
|---|---|---|
| P1 — high | **Checked-in RLS does not consistently bind profile IDs to the authenticated identity.** `step4_marketplace.sql` authorizes post/request inserts using a user ID without checking the corresponding profile ownership. `step5_messaging.sql` allows thread inserts when either user ID matches, without validating the paired profiles or industry/accepted-request rule. Thread and recipient-message UPDATE policies also permit more than the intended fields. A direct database API caller bypasses server actions. | **Unresolved database security risk.** These are findings in the checked-in SQL, not a claim that production currently runs those exact policies. The runtime uses `dm_messages`, while step5 creates `messages`, demonstrating why blindly patching old SQL is unsafe. Inspect deployed policies, column grants, constraints, and triggers before preparing a hand-run correction. |
| P1 — high | **Photo replacement destroys the old avatar/banner before the replacement uploads.** A timeout or failed save loses a working image. | Fixed: upload first, replace the existing row with ownership/concurrency filters, and only then clean up the old object. Failure-path regression tests added. |
| P1 — high | **Session refresh drops earlier cookie chunks.** Each cookie setter recreates the response, discarding previously added cookies. Chunked sessions can become unusable after refresh. | Fixed: preserve all previously written cookies, including when clearing obsolete chunks. Regression-tested with synthetic cookie values. |
| P1 — high | **Suspended members can invoke the normal publish action.** The admin path rejects this, but the member path did not. | Fixed in the publish action, including the write predicate. This is not a complete database-level suspension boundary; deployed grants/policies still need inspection. |
| P2 — medium | **Open-mic editing throws instead of saving.** The form sends `event_date`; the action reads missing `open_until` for expiry and would clear event date/location. | Fixed. Shared date calculation handles events, festivals, opportunities, and open mics; invalid expiry dates return an error instead of throwing. |
| P2 — medium | **Profile validation is only client-side.** The save action accepts an empty/malformed genre selection and a payload naming a different detail-table type. A failed link deletion is also ignored. | Fixed: run the existing validator server-side, compare the payload kind to the owned profile's stored type, and stop when link deletion fails. This is not a complete schema validator for every optional profile field. |
| P2 — medium | **Connection responses have a check/write race.** Two tabs can both read pending and then overwrite each other's response. Several mutations rely solely on RLS despite the project's query-scoping rule. | Fixed: response write requires recipient ownership and pending status, validates the decision, and verifies a row changed. Publish/unpublish writes include ownership. Band-tag updates include the caller's band ID; sharing also requires accepted status at write time. |
| P2 — medium | **Assistant telemetry can discard a valid answer or be lost.** Service-client creation can throw before `recordUsage` handles failures; an unawaited write may not finish before the request ends. | Fixed: include creation in the failure boundary and await recording. Daily-cap fail-open behavior remains deliberate and unchanged. |
| P2 — medium | **Dropdown keyboard navigation lacks reliable focus.** `autoFocus` on a `<ul>` does not provide the needed React focus behavior. Form labels in auth and post forms are not associated with their controls. | Fixed: focus the list explicitly and return focus on selection/Escape; associate labels and controls; allow keyboard access to password visibility. No layout redesign. |
| P2 — medium | **Support-email HTML escaping omits quotes used in an attribute.** Email validation allows some quote-containing strings, which are interpolated into `href`. | Fixed by escaping both quote types. No support email was sent to test it. |
| P2 — medium | **Lint is not configured.** Baseline `npm run lint` opens an interactive setup prompt and exits instead of checking code. | Added Next's existing core-web-vitals config and registered the already-installed TypeScript plugin. Fixed the exposed JSX escaping errors and effect dependency warnings without disabling checks. |

## Fixes by file

| File | Change |
|---|---|
| `.eslintrc.json` | Enable noninteractive Next lint and the installed TypeScript rules referenced by existing suppression comments. |
| `app/assistant/actions.ts` | Catch usage-client initialization failures and await usage recording. |
| `app/inbox/actions.ts` | Runtime decision check and an ownership-scoped, pending-only response update with a zero-row check. |
| `app/opportunities/actions.ts` | Fix open-mic editing, use shared expiry logic, and scope band-tag mutations. |
| `app/profile/[id]/actions.ts` | Scope publishing and unpublishing to the caller; prevent publishing suspended profiles and detect a failed publish. |
| `app/profile/edit/actions.ts` | Run shared validation server-side, reject mismatched profile types, surface failed link deletion. |
| `app/profile/edit/page.tsx` | Escape JSX apostrophes; rendered copy is unchanged. |
| `app/support/actions.ts` | Escape quotes in generated email HTML. |
| `components/admin/DirectoryOgImagePanel.tsx` | Escape a JSX apostrophe; rendered copy unchanged. |
| `components/admin/DirectoryWebsiteCheckPanel.tsx` | Escape a JSX apostrophe; rendered copy unchanged. |
| `components/auth/EmailSignInForm.tsx` | Associate email/password labels with controls. |
| `components/auth/EmailSignUpForm.tsx` | Associate all four labels with controls. |
| `components/auth/ForgotPasswordForm.tsx` | Associate the email label with its control. |
| `components/auth/ResetPasswordForm.tsx` | Associate password and confirmation labels with controls. |
| `components/auth/PasswordInput.tsx` | Accept an input ID and restore keyboard access to the visibility button. |
| `components/opportunities/PostCreationForm.tsx` | Associate text/date labels with controls; correct expiry-preview memo dependencies. |
| `components/opportunities/PostEditForm.tsx` | Same accessibility and memo-dependency corrections as creation. |
| `components/ui/Dropdown.tsx` | Explicit list focus, accessible list name, focus restoration after selection/Escape. |
| `lib/media/upload.ts` | Preserve existing media during replacement; update existing rows with ownership and previous-path filters; use unique storage filenames. |
| `lib/media/upload.test.ts` | Four mocked storage/database tests for failed upload, failed save, successful replacement, and first upload. |
| `lib/profile/validation.ts` | Reject missing payload structure and malformed/empty genre values using the canonical player-type options. |
| `lib/profile/validation.test.ts` | Ten malformed-payload/genre cases. |
| `lib/supabase/marketplace.ts` | Shared, timezone-independent expiry-date calculation with invalid-date rejection. |
| `lib/supabase/marketplace.test.ts` | Nine expiry cases covering every post type, rollover, and malformed dates. |
| `lib/supabase/middleware.ts` | Preserve all outgoing refresh-cookie chunks. |
| `lib/supabase/middleware.test.ts` | Two mocked refresh cases covering multiple chunks and removal of an obsolete chunk. |
| `app/admin/actions.ts` | `adminDeleteUser` now also deletes the Supabase Auth account and the user's `profile-media` storage objects, per the resolved product decision (finding 2 below). |
| `PROGRESS.md` | Record the unshipped audit status, decision, and updated test count. |
| `AUDIT.md` | This review and its verification limits. |

## Deliberately unchanged / follow-up required

1. ~~**Database security and schema drift (high).**~~ Resolved: live `pg_policies`, `information_schema.columns`, and `information_schema.triggers` were pulled directly from production (not assumed from checked-in SQL) and compared against what step4/step5 claimed. Confirmed real: `messages` was renamed to `dm_messages` outside any migration file, but its triggers followed correctly; RLS is enabled on every real table (the one `rls_enabled = false` result is `spatial_ref_sys`, a PostGIS system table, not app data). Two confirmed gaps fixed in `migrations/step20_rls_hardening.sql`: (1) `mp_posts_owner_insert`/`cr_requester_insert` checked only `*_user_id = auth.uid()`, never that the paired `*_profile_id` actually belonged to that user, and marketplace's own "bands can't post" comment was never enforced in SQL; (2) `mt_party_insert` let any two user ids open a thread directly, with no check that they'd ever accepted a Connect request. Also closed: none of `mp_posts_owner_update`, `cr_recipient_update`, `mt_party_update`, `dm_recipient_mark_read` had a `WITH CHECK`, so satisfying the USING clause let a caller rewrite any column, not just the intended one — Postgres RLS can't compare old vs. new values in a `WITH CHECK`, so each is now paired with a `BEFORE UPDATE` trigger that locks the columns that must never change. Migration is additive/idempotent and touches no existing row; not yet run against production — see PROGRESS.md §3.
2. ~~**Admin account deletion (product decision).**~~ Resolved: the product decision is that "Delete user" removes the person, not just their data. `adminDeleteUser` now also deletes the Supabase Auth account (`auth.admin.deleteUser`) and clears their `profile-media/${userId}/` storage objects, after the existing DB deletes succeed. See `app/admin/actions.ts`.
3. ~~**Suspension scope (product/database decision).**~~ Resolved: "standard moderation lock" — blocks new posts, new connection requests, accepting a request, and new messages, and closes existing active posts; login, reading own data, declining, and marking-read stay available. See PROGRESS.md §2 #24 and `migrations/step22_suspension_enforcement.sql`.
4. **Multi-step data writes (medium).** Social-link replacement is still delete-then-insert, explicitly documented in README; an insert failure after deletion can lose links. Profile/detail/user saves and roster reorders are also multiple operations rather than one transaction. Fixing this reliably needs a deployed transaction/RPC and schema verification, not a misleading client-side rollback. Active-post limits and concurrent first open-mic signups also lack atomic serialization.
5. **Onboarding player-type changes (medium, schema confirmation needed).** The flow upserts on `(user_id, player_type)`, while readers expect one profile per user via `maybeSingle()`. Changing type can create multiple rows unless another live constraint prevents it. Verify the actual unique constraints and decide how incomplete profiles should be reused; do not delete existing profiles to guess at this.
6. **Calendar consistency (medium).** Marketplace uses UTC date keys and database `CURRENT_DATE`, while the product is Austin-based. `cycleDateKey` subtracts nine elapsed hours, and AI midnight derives its offset from the current instant; both deserve DST-boundary tests. The intentional 9am feed boundary remains unchanged. A calendar correction should be verified together with SQL expiry behavior.
7. **Paid/public endpoints and job concurrency (medium).** The retained, unused address-validation endpoint has no authentication gate and can call Google. The support endpoint has a honeypot but no durable rate cap. Background backfills select unattempted rows without atomically claiming them, so simultaneous runs can repeat work/credits. No paid API, captcha, queue, or new rate-limit infrastructure was introduced. Clarify deployment controls and intended access before choosing these changes.
8. **Remote fetch hardening (medium).** Admin directory fetches follow remote redirects; remote-image size is checked after buffering. These deserve private-network/redirect and streaming-byte-limit review. They are admin-triggered, not an observed unauthenticated fetch endpoint. No claim of a proven production exploit is made.
9. **Remaining UI polish (low).** `EventCard.tsx` still references the nonexistent `brand-gray-500` on a decorative chevron. The docs' claim of roughly twenty affected files is stale: the targeted search found this single occurrence. Password visibility retains its existing small target; expanding it and broader modal/keyboard/mobile coverage remain unverified. No visual restyling was guessed.
10. **Preserved decisions and unused code.** Kept the `lg` navigation cutoff, feed fallback, one-year retention, iframe allowlist/direct-media distinction, AI fail-open cap, paid-filter meaning, source-specific cron cadence, and directory column grants. Retained unused schema history, legacy video-upload support, and the address endpoint rather than removing documented future/compatibility paths. No dependency upgrade or vulnerability certification was attempted.
11. **External operations.** The outstanding migration/configuration, Resend domain, Firecrawl retry, and native Uber-device checks in PROGRESS remain unverified; none was marked complete. No AI requests, support messages, cron writes, production account mutations, or paid backfills were triggered.

## Validation

- Baseline: 568 tests passed; TypeScript passed; lint exited into a setup prompt.
- Updated suite: 593 tests passed in 36 files. All new tests use mocks and do not contact external services.
- Regression proof: reverting the profile/media fixes and open-mic expiry branch caused 14 failures; reverting cookie preservation caused two more failures. Fixed files were restored in `finally` blocks.
- TypeScript: `npx tsc --noEmit` passed.
- Lint: `npm run lint` passed with no warnings or errors after configuration and existing errors were corrected.
- Diff whitespace: `git diff --check` passed.
- Browser: local `/live` rendered HTTP 200 with an empty state. Verified dropdown focus, arrow-key selection, Enter, and focus returning to the trigger. Screenshots and DOM width checks at 375, 768, 1024, and 1440 showed no horizontal overflow in that empty-state page. Temporary viewport override was reset.
- **Not verified:** authenticated database mutations, actual refreshed login sessions, production RLS/grants, delivered email, real photo uploads, populated-card layouts, full keyboard coverage, all routes at all four widths, or a production build. Browser navigation was intermittently timing out, and no authenticated test account was supplied. This is an audit with local fixes, not a production security sign-off or a claim that every route is bug-free.
