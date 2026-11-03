# Acceptance and handoff

## Local foundation

- First launch: no names, date, guests, money or tasks seeded.
- Continue setup with all fields empty: generic wedding title appears.
- Add a recommendation twice: only one linked task should exist.
- Create a task, mark complete, filter open tasks, reopen the app: state remains.
- Reset demo in Settings requires a second explicit confirmation.
- Tabs for vendors and guests clearly explain that CRUD is future work.

## Task management

- Create/edit all task fields, including a blank optional deadline and notes.
- Verify each partner sees their own assignments plus shared tasks under Mine.
- Search title and notes; combine category/status filters and due/priority sorting.
- Completed work is excluded from overdue indicators.
- Saving from a filtered view returns to an unfiltered list so the saved task is visible.
- Canceling deletion preserves the task; confirmed deletion removes it for both partners.
- A stale edit/delete is rejected; the editor keeps the draft and requests reopening.
- Local v0.1 data upgrades on load without clearing existing tasks.

## Connected staging (requires a real Supabase project)

Apply `202611030002_task_management.sql` once to existing v0.1 databases first.


1. Disable demo via `npm run start:auth`; sign up and verify email.
2. Close/reopen the iOS app: the native session restores without password entry.
3. Create wedding with account A; invite and join with account B on another device.
4. Add a task on A: B sees it. Make overlapping completion edits: stale version
   must display a conflict and reload rather than silently overwrite.
5. Account C must not read A/B wedding, members or tasks, including raw API calls.
6. A third participant, an expired code, a consumed code and a replaced code fail.
7. Disconnected save produces an error, never a false success indicator.
8. Logout must remove local session. A user without a token cannot reach data routes.

## Physical iPhone biometric acceptance

- Test Face ID and Touch ID where available on signed development/preview builds.
- Enable only after authenticated sign-in; enrolling/not-enrolling hardware states.
- Cancel, deny permission and repeated failures keep the content inaccessible.
- Background/reopen and cold launch lock before mounting private data screens.
- Token refresh events must not remove an existing biometric lock.
- Logout/password fallback permits fresh password authentication.
- Changed biometric enrollment and expired/revoked sessions need device checks.

## Production gate

- Configure backend and Apple/Expo ownership; confirm real auth on a release build.
- Run RLS negative tests above against staging and resolve any issues.
- Add account deletion, recovery, privacy/support URLs before public distribution.
- Set production email delivery and account rate limits in Supabase.
- Verify release has no demo data/bypass even if EXPO_PUBLIC_DEV_SESSION=true.
- Implement remaining product modules before calling the wedding manager complete.

This checklist separates implemented foundation from tests requiring external
accounts/devices. It does not claim these manual checks have already passed.

## Budget and vendor acceptance

Apply migration 003 after migration 002 on an existing Supabase backend.

- Test one partner adding a booked vendor and the other seeing it in Budget.
- Verify quotes do not count before booking, including multiple quotes for the same category.
- Create a planned installment, mark it paid and confirm there is still one record.
- Try simultaneous installments that together exceed the agreed price: one must fail.
- Test retrying the same create after a network timeout: no duplicate entry.
- Price/status changes and deletion must respect existing payment allocations.
- An unrelated account must not read/write finance records or call RPCs for another wedding.
- Rebuild an installed native development client to include expo-crypto.

## Guest invitation acceptance

Apply migration 004 after the previous migrations.

- Both partners can manage invitations; an unrelated account cannot read contact/dietary data.
- One family is one invitation but may contain several invited/confirmed people.
- Partial RSVP respects separate adult/child limits and reconciles the global totals.
- Side/group/status filters and dietary/contact search work without changing global summaries.
- Duplicate phones produce an advisory while allowing legitimate separate invitations.
- Stale edits preserve the draft; delete requires confirmation and an up-to-date version.
- Verify live create/update/delete synchronization on two devices and a list above 1,000 rows.
- No guest-facing messages or links are sent by manual RSVP actions.
