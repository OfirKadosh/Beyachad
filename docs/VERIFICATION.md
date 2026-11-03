# Verification · 2026-11-03

Passed on the delivered source:

- `npm run check`: TypeScript, Expo ESLint, 32 tests, including core behavior, task rules and PostgreSQL migration/RLS checks.
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
