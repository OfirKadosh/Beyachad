# Verification · 2026-11-03

Passed on the delivered source:

- `npm run check`: TypeScript (app + server handler), Expo ESLint, 79 tests, including core behavior, task rules and PostgreSQL migration/RLS checks.
- `npx expo install --check`: SDK-compatible dependencies.
- `npm run export:web`: release web bundle generated successfully.
- Chromium UI smoke: empty initial fields, generic wedding creation, recommendation
  added once, task creation, completion, open filtering, state after reload, navigation,
  two-step local reset, no horizontal overflow at 320 / 390 / 736 px.
- No JavaScript runtime errors or browser console errors in the final UI smoke.
- Chromium release smoke: '/', '/tasks', '/settings' and '/setup' require login;
  existing development data is ignored; missing backend credentials disable login;
  registration and password confirmation are displayed.

Browser checks exercise the React Native Web build; they do not substitute for
physical iPhone testing. Hosted Supabase registration/RLS, cross-device realtime,
invitation concurrency and native biometric/signing behavior remain unverified
until an owned backend project and physical device are configured.

The browser runner is an environment-specific QA helper and is not shipped as a
project dependency. Portable core tests and GitHub CI are included in the source.

## v0.2 task management

- Task creation with assignee, status, priority, category, due date and notes.
- Editing and notes search; stable assignment filtering from the current viewpoint.
- Completion/reopen and persistence after reload.
- Delete confirmation and cancellation.
- Stale-edit rejection while retaining the typed draft; stale writes do not win.
- Upcoming tasks on Home; no horizontal overflow at 320 / 390 / 736 px.
- No runtime or console errors in the final task UI run.
- New migration executed in PGlite against a minimal v0.1 schema fixture: legacy
  data upgrade, status/completed synchronization, column grants, RLS isolation,
  version checks and shared partner access passed. Hosted Realtime remains a
  separate staging check.

## v0.3 budget and vendors

- Vendor creation/editing/deletion, booking with agreed price and quote tracking.
- Planned payment to paid uses one record; paid and planned allocations cannot exceed agreement.
- Invalid price reduction and deletion with existing payment records are rejected.
- Budget target edits and overdue/overrun summaries use integer-agora arithmetic.
- Task writes preserve vendor/payment records and the updated target across reloads.
- Stale vendor edits retain the typed draft; reset/delete actions require confirmation.
- Browser checks at 320 / 390 / 736 px passed without runtime/console errors.
- PGlite executes migration 003 against a baseline fixture and checks read RLS,
  RPC membership, anonymous denial, direct-write denial, idempotency, versions and totals.
  Hosted Realtime and physical-device tests remain separate checks.

## v0.4 guest invitations

- Domain and PostgreSQL tests: invitation/person reconciliation, partial RSVP,
  per-age limits, invalid states, stable sides, private reads, RPC-only mutations,
  idempotent create, optimistic edit/delete conflicts and anonymous denial.
- Paged loading tested with 1,201 rows and a simulated 100-row server cap.
- Hosted Supabase Auth/Realtime and physical iPhone checks remain separate.
- Browser UI flow passed: empty-form validation, partial confirmations, dietary search,
  status/side/group filters, duplicate phone advisory, Home summary, persistent coexistence
  with tasks/vendors, stale-draft preservation and confirmed deletion.
- Guest list/editor fit at 320 / 390 / 736 px without runtime or console errors.

## v0.5 meetings and reminders

- Core and SQL tests: zoned UTC round-trip, DST gaps/repeats, meeting bounds,
  participant-aware overlaps, idempotent creation, stale edits/deletes, private
  tenant access and linked-vendor deletion preserving meeting history.
- Fake adapter tests: no automatic permission prompts, future-only top-50 limits,
  idempotent reconciliation, date replacement, source removal, account changes,
  permission denial and sign-out invalidating an in-flight schedule.
- Native adapter TypeScript validation is not proof of OS notification delivery.
  Physical-device notification and live Supabase acceptance remain outstanding.
- Browser flow passed: zoned meeting create/edit, missing DST hour rejection,
  overlap warning, reminder navigation, task completion removal, vendor unlink,
  stale-draft retention, cancellation/deletion and reload persistence.
- Meeting list and editor fit at 320 / 390 / 736 px; cancelling an edit preserves
  the list filter. No browser runtime or console errors were observed.
- Task, finance and guest browser regression flows passed. Production export
  rejects development-session bypasses and protects the new direct routes.
- All 62 automated tests, TypeScript and lint passed. SDK dependency compatibility,
  production Web export and iOS JavaScript/Hermes export passed. The iOS export
  is not a signed native build or a physical-device delivery test.

## v0.6 visual refresh and daily-use completion

- All 76 tests, app/server TypeScript checks and Expo lint passed.
- The full 001–006 SQL chain executes in PGlite with minimal Auth/Storage schemas
  and deterministic extension stubs: independently versioned wedding details,
  tenant-private document reads, server-only metadata registration, linked-vendor
  validation/unlink, ownership transfer, stable member slots, re-invitation,
  departure, final-member document guard and Auth-user deletion passed.
- Document request-handler tests run with mocked Auth/Storage services: invalid
  tokens and membership fail before storage, file headers/size are checked,
  failed registration removes uploaded bytes, failed removal preserves retry metadata.
- Binary base64 codec works without browser globals and matches Node's standard
  encoder across chunk boundaries. Native file-picker/share behavior remains unverified.
- Browser daily-use flow passed: generic setup, invalid date, details persistence,
  stale-draft retention, task coexistence, Home payment shortcut, supplier/payment-linked
  document upload, incorrect file rejection, image preview, reload and confirmed deletion.
- Home/documents fit at 320 / 390 / 736 px. Both normal/reduced-motion preferences
  were exercised; no runtime/console errors occurred in the final daily-use flow.
- Mocked Auth browser flow passed recovery email/OTP/new-password/sign-out, prevention
  of planning-provider loads during recovery, password verification before deletion,
  and account deletion both with an existing wedding and before initial setup.
  This does not verify hosted email delivery, Auth administration or cloud account cleanup.
- Existing task, finance, guest and meeting browser regression flows passed.
- Production Web export and iOS JavaScript/Hermes export passed. Signed native builds,
  live Supabase/Storage/Edge integration, multi-device Realtime, biometrics and actual
  iPhone notification delivery remain the release checks in RELEASE-he.md.

## v0.6.1 authentication configuration

- 79 automated tests, app/server TypeScript and lint passed; production Web export passed.
- Configured browser Auth flows passed with the legacy EXPO_PUBLIC_SUPABASE_ANON_KEY
  name, including recovery and deletion against mocked endpoints.
- Missing-config production browser flow stays blocked even with a valid email,
  matching 10-character passwords, and displays the configuration explanation.
- Diagnostic tests verify env precedence, absent/invalid URLs, empty keys, legacy-key
  fallback, disabled dotenv loading, Windows .env.txt hints and value-free output.
- These checks do not verify the user's local env file or a live signup request.
