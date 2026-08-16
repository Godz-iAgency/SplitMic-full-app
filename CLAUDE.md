# CLAUDE.md

Working standard for an AI coding assistant in this repository.

## How this file relates to the other docs

Three files, three jobs. Do not duplicate content between them.

| File | Holds | Update when |
|---|---|---|
| `CLAUDE.md` (this file) | *How* to work: standards, guardrails, patterns to follow | A durable rule or convention changes |
| [`README.md`](README.md) | *What* the system is: stack, setup, structure, how each feature works | A feature's mechanics or setup changes |
| [`PROGRESS.md`](PROGRESS.md) | *Where* it stands: status, the decision log (§2), operational checklist (§3), what's next (§4) | Any meaningful change ships |

Read `README.md` for how a feature works before changing it. Read `PROGRESS.md` §2
before re-litigating a decision — several entries record options that were tried
and deliberately rejected, with the reasoning. Adding a decision there is part of
finishing the work, not paperwork after it.

`migrations/SCHEMA_HISTORY.md` explains the gaps in the migration numbering.

---

## Core Working Standard

Act as a senior software engineer and reviewer.

Do not rush into code changes. Before making a significant change:

1. Understand the requested outcome.
2. Inspect the existing implementation.
3. Identify likely risks or regressions.
4. Prefer the smallest safe change.
5. Avoid introducing duplicate logic.
6. Validate the result before considering the task complete.

When a request is ambiguous, use the existing repository structure and
conventions as the primary guide.

**Verify claims rather than asserting them.** "This should work" is not a
result. Run the test, query the live endpoint, load the page, check the row
count. When a fix depends on external state (a migration, an env var, a
third-party API), confirm that state directly instead of assuming it.

**Report outcomes honestly.** If something failed, say so with the output. If a
step was skipped, say that. If a previous explanation turns out to have been
wrong, correct it explicitly rather than quietly moving on — a wrong diagnosis
left standing costs more than the original bug.

---

## Review Principles

Evaluate changes from the perspectives relevant to the task:

- Product usability
- User experience
- Frontend engineering
- Backend engineering
- Security
- Quality assurance
- Reliability
- Operations
- Accessibility
- Performance
- Data integrity
- Maintainability
- Deployment safety

Not every task requires every perspective to be discussed explicitly, but
important failure surfaces should not be ignored.

---

## Change Discipline

Before adding something new, check whether:

- It already exists.
- An existing implementation should be improved instead.
- The change would duplicate functionality.
- The change introduces unnecessary complexity.
- The request can be solved with a smaller modification.

Prefer improvement and simplification over expansion.

Keep a task focused. Do not make unrelated changes while working on one, and do
not bundle unrelated fixes into a single deployment without a clear reason —
when something ships broken, a narrow change is far easier to identify and
revert.

---

## Source of Truth

Avoid duplicate sources of truth. Shared business rules, states, configuration
values, validation rules, and reusable logic come from their canonical modules.

Canonical modules in this repo — read from these rather than re-deriving:

| Concern | Canonical source |
|---|---|
| Player types & profile field shapes | `lib/types.ts` |
| Admin access | `lib/supabase/admin.ts` (`isAdminEmail`) |
| Directory categories, labels, slugs | `lib/directory/categories.ts` |
| Directory tiers & outreach states | `lib/supabase/adminDirectory.ts` |
| Austin-local time & the "today" cycle | `lib/events/time.ts` |
| Cron request auth | `lib/http/cronAuth.ts` |
| Video embed resolution & allowlist | `lib/media/videoEmbed.ts` |
| Design tokens | `tailwind.config.ts` |

Do not hardcode a value in a second place when a shared source exists. When two
parts of the application disagree, investigate the canonical source before
changing behavior.

---

## Security

Treat all client-provided data as untrusted.

Important state-changing operations should:

- Authenticate the caller when required.
- Verify authorization and ownership.
- Validate input server-side.
- Prevent privilege escalation.
- Prevent direct object reference vulnerabilities.
- Prevent replay or duplicate mutations when applicable.
- Avoid exposing private or administrative data.
- Keep credentials and secrets out of source code.

Do not weaken security controls merely to make a feature easier to implement.

### In this codebase specifically

- **Ownership is enforced in the query, not before it.** Server actions scope
  writes with `.eq("id", x).eq("user_id", user.id)` so a record the caller does
  not own matches zero rows. Follow that pattern rather than a separate check
  that can drift from the write it guards.
- **RLS is not sufficient on its own.** RLS is row-level; the public anon key
  can still request any *column* of a readable row via PostgREST. Where a table
  has columns the public must never see, revoke the blanket grant and re-grant
  an explicit column list — see `migrations/step11_business_directory.sql`,
  which hides scraped contact emails and the outreach pipeline this way. Adding
  a new column to such a table means deciding, explicitly, whether it gets a
  grant.
- **The service-role client bypasses RLS entirely.** Use it only in server-side
  code that has already established authorization. It must never be reachable
  from a client bundle.
- **Scheduled endpoints fail closed.** They require
  `Authorization: Bearer $CRON_SECRET` and refuse to run at all when the secret
  is unset, so an unconfigured deploy can never expose an unauthenticated write.
- **Never render user-supplied URLs in an iframe.** An iframe loads a full page
  that can impersonate this site — a convincing fake login form on our own
  domain. `lib/media/videoEmbed.ts` allows iframes only from a fixed provider
  allowlist, while permitting direct media files from any host because a
  `<video>` element decodes bytes and cannot render markup. That distinction
  is the security boundary; preserve it.

---

## Data Integrity

State transitions should be deliberate and validated. For important workflows:

- Reject invalid transitions.
- Avoid race conditions.
- Make repeated requests safe where practical.
- Distinguish pending, successful, failed, and completed states.
- Do not report success when the underlying operation failed.
- Preserve an auditable history when the application already supports one
  (`admin_action_log`, and marketplace posts, which are the only record of a
  show's history — see `PROGRESS.md` §2 #6/#7 before shortening retention).

### Batch and background jobs

Every batch job here is **resumable and never repeats work**: a status column
where `NULL` means "never attempted", queries filtered on `.is(status, null)`,
and every touched row marked with its outcome. This is what makes a job safe to
stop midway, and — where a job costs money per row — safe to re-run without
double-billing. See `lib/directory/ogImageJob.ts` and `screenshotJob.ts`.

**A configuration error is not a per-row failure.** If an API key is missing,
short-circuit the entire batch with one clear error. Recording it as N
individual row failures is wrong twice over: nothing was actually attempted,
and those rows are then wrongly excluded from future runs.

**Job results must distinguish healthy from broken.** A metric that reads
identically in both states will hide a bug indefinitely. `SyncResult` reports
`eventsSkippedPast` for exactly this reason: without it, "scraped 16, wrote 0"
looks the same whether the source page was stale or the night was simply quiet
— and that ambiguity concealed a real outage for a full day. When adding a job,
ask what its output looks like when the job is silently broken, and add the
field that would make the difference obvious.

---

## Financial and Sensitive Operations

Applies to money, credits, balances, refunds, payouts, permissions, and any
other sensitive state.

- Never trust browser-calculated authoritative values.
- Recalculate or validate sensitive values server-side.
- Keep external-provider state and internal database state consistent.
- Use idempotency or equivalent duplicate-protection where appropriate.
- Clearly separate different financial states rather than collapsing them into
  one ambiguous status.
- Do not expose internal financial calculations to users unless the product
  explicitly requires it.

### Guest payments to bands (planned)

The next major feature lets a guest scan a code on a band's profile and pay
that band directly. It is not built yet; when it is, these constraints apply.

- **The scanned code must encode the profile identifier, not a destination
  account.** Resolve the payee server-side from that profile. A code carrying
  the destination directly can be replaced with a sticker pointing at someone
  else's account, and nothing downstream would detect it.
- **Payer is unauthenticated.** There is no session to trust, so every value —
  amount, recipient, currency — must be validated or recomputed server-side.
  Treat the entire request body as hostile.
- **Money moves between two third parties.** The platform is not the merchant
  of record for a tip to a band, which makes payout state, fee handling, and
  refund authority explicit design decisions, not defaults.
- **Webhooks are the source of truth for payment state, and must be signature
  verified.** A client-side "payment succeeded" callback is a claim, not a
  fact. Never mark a payment complete on the strength of a redirect.
- **Idempotency is mandatory, not optional.** Retries, double-taps, and
  duplicate webhook deliveries are all normal. A repeated request must never
  produce a second charge or a second payout.
- **Separate the states.** `initiated`, `authorized`, `succeeded`, `failed`,
  `refunded`, and `paid_out` are different facts. Do not compress them into a
  single boolean.
- **Never log or store raw card data.** Card details belong to the payment
  provider's hosted form; they should never reach this application's servers,
  logs, or database.

Record the payment-provider decision and its reasoning in `PROGRESS.md` §2 when
it is made.

---

## Responsive and PWA Behavior

This is an installable PWA used across phone, tablet, small laptop, and large
desktop. A change is not finished when it works at one width.

**Current breakpoint reality — know this before adding UI.** The codebase uses
`sm:` (640px) heavily and `lg:` (1024px) moderately; `md:` and `xl:` are almost
unused. That is mostly deliberate, not neglect:

- **The app chrome's `lg` cutoff is an intentional decision — do not "fix" it
  to `md`.** `AppHeader.tsx` keeps the bottom tab bar and the collapsed header
  all the way to 1024px because portrait tablets (e.g. Galaxy Tab A7) report an
  800px CSS width, which is above `md`, and would otherwise get the crowded
  desktop pill nav. The reasoning is in that file's docstring.
- **The real hazard is card width, not viewport width.** Grids run
  `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, so a card is *widest just below
  `lg`* — two columns sharing ~1000px — and then gets narrower when a third
  column appears. Card width is therefore not monotonic with viewport width.
  Any fixed-height element inside a card will letterbox worst in the middle of
  the tablet range. Measured example: the directory card's image band hit 4.1:1
  at 1005px against 2.8:1 on desktop, fixed with `h-28 md:h-36 lg:h-28`.
- When adding a fixed-height element inside a fluid-width card, check its
  proportions at ~1000px specifically, not just phone and desktop.
- Very wide screens should be constrained by `max-w-*` containers rather than
  allowed to stretch text to unreadable line lengths.

**Requirements for any UI change:**

- Mobile-first. Style the phone case, then layer breakpoints upward.
- Touch targets stay comfortably tappable — roughly 44px minimum on touch
  widths. Controls that shrink at desktop sizes must not shrink below that on
  mobile.
- No horizontal page scroll at any width. Wide content (tables, code blocks,
  long unbroken strings) scrolls inside its own container.
- Test at phone (≈375px), tablet (≈768px), laptop (≈1024px), and wide (≈1440px)
  when layout changes. Not just the width you happened to be viewing.
- Respect safe areas and avoid fixed elements that collide with mobile browser
  chrome or the installed PWA's status bar.
- Offline and slow-network behavior matters more here than in a normal web app
  because the app is installable. A failed fetch should degrade to a clear
  state, never a blank screen.
- **Interactive elements need a press state, not just a hover state.** `hover:`
  barely fires on the touch devices this app is installed on, so a control
  styled only for hover gives no response until navigation completes. Apply
  `.tappable` (or `.tappable-lg` on full-width surfaces) from `globals.css`
  rather than hand-rolling `active:scale-*` — the native tap highlight is
  suppressed globally, so an element with neither is genuinely silent when
  pressed. Note that a literal `transition` utility on the same element
  overrides those classes' timing (utilities are emitted after components);
  where an element needs both, declare the transition once. See
  `PROGRESS.md` §2 #15.

---

## External Data, Scraping, and AI Extraction

Data from outside this system is a claim, not a fact. Two failures already
reached production; both are cheap to prevent and expensive to detect.

- **Never trust extracted content from a page that did not return 2xx.** A
  scraper will happily feed an error page to an LLM, which then invents
  well-formed, entirely fictional records to satisfy the schema. Check the
  scraped page's own status code before using anything derived from it
  (`lib/events/do512.ts`). Schema-shaped output is not evidence the source had
  data.
- **Validate extracted values against reality, not just against the schema.**
  A "today" listing cannot contain an event a year out. Range and plausibility
  checks catch fabrication that passes type checks.
- **Know whether a URL's content is time-bound before caching it.** Scrape
  caches key on URL. `…/events/live-music/today` is a permanent URL whose
  content turns over daily, so a cache hit silently re-serves yesterday —
  hence `maxAge: 0` there. The opposite is true for a business's homepage
  screenshot, where a cache hit is desirable and saves a credit. Decide per
  URL, not per API.
- **External clients never throw.** Every client here returns a discriminated
  result — `{ ok: true, data }` or `{ ok: false, reason }` — so one bad row or
  one unreachable host cannot abort a batch. Follow this in any new client
  (`lib/ai/gemini.ts`, `lib/events/do512.ts`, `lib/directory/ogImage.ts`,
  `lib/directory/websiteCheck.ts`).
- **Be conservative when classifying something as broken.** `websiteCheck.ts`
  marks a listing `dead` only on a non-resolving domain, refused connection, or
  hard 404/410; timeouts, 403s, and 5xx are `uncertain`. Wrongly retiring a
  real business is worse than leaving one unresolved.

---

## User Experience

Changes should remain clear, consistent, mobile-friendly, accessible,
low-friction, and predictable.

Users should not receive contradictory messages from different parts of the
application. Avoid duplicate labels, duplicate calls to action, unnecessary
steps, excessive content, and confusing status language.

When something cannot work, say why and what to do instead. A rejected input
should explain the constraint, not just refuse — an unsupported video link
names the platform and lists what does work rather than failing silently.

---

## Operational Reliability

Important workflows should fail safely. Consider:

- Empty states
- Failed requests
- Delayed external services
- Duplicate submissions
- Partial completion
- Expired sessions
- Missing data
- Network interruptions
- Retry behavior

A non-critical notification failure must not corrupt the primary business
transaction.

**Public pages degrade rather than error.** `/`, `/live`, and `/directory`
require no login: they read via the service-role client, set an explicit
`revalidate`, and wrap data fetching so a failure renders an empty state
instead of a 500. Follow that pattern for any new public page.

**Partial success must not trigger destructive cleanup.** The event sync skips
its deactivation step when only one source page scraped successfully, so a
transient outage can never wipe real listings. Apply the same caution to any
job that deletes or deactivates based on what it just fetched.

---

## Testing Standard

For meaningful changes:

1. Test the primary happy path.
2. Test relevant failure paths.
3. Test authorization boundaries.
4. Test responsive behavior when UI is affected (see the widths above).
5. Test repeated actions when duplicate execution could cause harm.
6. Confirm unrelated workflows still behave as expected.

```bash
npm test            # Vitest, run once
npm run test:watch  # re-run on change
npx tsc --noEmit    # type check
npm run lint
```

Tests live beside the code they cover (`lib/**/*.test.ts`) and cover pure
decision logic — no database, browser, or network. Server actions and React
components are not covered and are verified manually.

**A regression guard must be proven to fire.** After writing a test for a bug,
temporarily reverse the fix and confirm the test actually fails, then restore
it. A guard that passes against broken code is worse than none, because it
manufactures false confidence. Several guards in this repo were validated this
way and the practice has caught real gaps.

**Update the test count in `PROGRESS.md` §Tests** when adding tests.

---

## Migrations and Deployment Safety

Migrations are hand-run SQL files in `migrations/`, applied in numeric order
through the Supabase SQL editor. There is no automated migration runner.

**Run an additive migration before deploying the code that reads it.** Adding a
column to a `select` list and shipping it first will break every page using that
query — PostgREST errors on the unknown column, and the page 404s or empties.
Additive migrations (`ADD COLUMN IF NOT EXISTS`) are safe to apply against
already-running code, so migration-first is always the correct order. State this
explicitly when handing a migration over, and record blocking migrations in
`PROGRESS.md` §3.

Unused columns from an abandoned approach are left in place as harmless schema
history rather than dropped; see `SCHEMA_HISTORY.md`.

Before deploying a meaningful change:

- Review the exact files changed.
- Confirm the change is limited to the requested scope.
- Check for accidental secrets or sensitive data. `.env.local` is gitignored —
  verify with `git check-ignore -v .env.local` before any commit touching
  env-adjacent files.
- Run available validation or tests.
- Verify the critical workflows the change touches.
- Keep the change reversible where practical.

**Prefer soft, reversible removal over deletion.** Hiding a directory listing
sets `is_active = false` rather than deleting the row, so a mistake costs one
click instead of a re-import.

Do not commit, push, or deploy unless asked.

---

## Code Quality

Follow existing conventions. Prefer small functions, clear naming, reusable
shared logic, explicit validation, minimal duplication, and predictable control
flow. Comments should explain *why*, not restate *what* — the existing code
documents its reasoning, especially where a non-obvious choice was made, and new
code should match that density rather than being either bare or over-annotated.

Avoid unnecessary abstractions, rewrites, framework migrations, or architectural
changes unless the task specifically requires them.

**Design tokens:** only the colors defined in `tailwind.config.ts` exist —
`brand-orange` (+`-dark`/`-light`), `brand-black`, and `brand-gray-900`/`-800`/
`-400`/`-300`/`-200`. Anything else silently produces **no CSS at all**. Roughly
20 files currently reference nonexistent tokens (`brand-gray-500`, `-100`,
`-700`) and render colorless as a result. Do not add new uses; fix them when
working in an affected file.

Note also that `fontSize` is deliberately scaled one step up from Tailwind's
defaults for dark-mode legibility — `text-sm` is 16px here, not 14px.

---

## Existing Architecture

Respect the architecture already present. Before introducing a new library,
service, framework, database pattern, state-management approach, authentication
method, or deployment mechanism, confirm the current system cannot reasonably
solve the problem.

Do not infer that a larger architectural change is desirable simply because it
is more modern.

Prefer a plain `fetch` against a documented REST endpoint over adding an SDK for
a single call — that is the established pattern for every external service here.

---

## Content and Design

Reuse existing components, styles, assets, and design tokens. Do not invent a
second visual system inside the same product.

Prefer authentic application content and assets over generic filler. Avoid
duplicating pages or sections that serve the same purpose.

Public pages compete for real search traffic, so two pages must not target the
same phrase — `/live` and `/directory` deliberately split "Austin live music"
rather than both claiming it (`PROGRESS.md` §2 #13).

---

## Task Completion

A coding task is not complete merely because code was written. Completion means:

- The requested behavior was implemented.
- The affected workflow was validated — actually run, not assumed.
- No obvious regression was introduced.
- The change remains within scope.
- Docs were updated where the change affects them (`PROGRESS.md` status and
  decision log; `README.md` if a feature's mechanics changed).
- Any unresolved risk is clearly identified.

If something remains unverified — because it needs a migration, a deploy, or an
external service — say so plainly rather than implying it was checked.

---

## Response Format

Match the response to the task. Most work needs a few clear sentences, not a
template.

Cover, in whatever form fits: what changed and why, which files, what
validation was actually performed, and what risk or limitation remains. For a
review or audit, cover what was reviewed, the important findings, their
severity, and what needs to happen next.

Use headings and structure when the work genuinely has several distinct parts.
Do not impose section headers on a one-line fix. Lead with the finding that
matters most — especially when it is bad news.

---

## Final Principle

Do not make the repository larger or more complicated without a reason. Make
changes that improve correctness, clarity, safety, usability, reliability, and
maintainability.
