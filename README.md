# ביחד · Beyachad

A private, Hebrew-first wedding planner for two partners. Expo SDK 58, React Native,
TypeScript and Expo Router. Version 0.4.0 includes tasks, budget, vendors and guest invitations with manual RSVP.
Meetings, reminders and distribution acceptance remain on the roadmap.

## Run locally (Windows / macOS / Linux)

Install Node.js 24 LTS, then open this directory in a terminal:

```sh
npm ci
npm start
```

`npm start` opens a **development-only, automatically connected local workspace**.
It starts with empty names, no wedding date, no budget, and no tasks. The setup
screen creates the workspace on this device. Recommendations can be added to tasks.
`npm run web` opens the same code in a browser for quick UI review. This remains a
React Native app; the browser is an additional development target.

SDK 58 requires a compatible Expo client. If the App Store Expo Go build does not
support it, use a development build. Face ID requires a native development build.

```sh
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform ios --profile development
```

The bundle identifiers in app.json are provisional. Choose identifiers under your
own Apple/Expo account before a signed build. EAS needs your Expo account and iOS
signing setup; no app was signed, uploaded or published by this deliverable.

## Real accounts and shared data

1. Create a Supabase project in your own account.
2. Run the SQL files in `supabase/migrations/` in filename order in its SQL editor.
   Existing installations run only migrations newer than those already applied.
   v0.3 needs migration 004; v0.2 needs 003 and 004; v0.1 needs 002–004.
3. Copy `.env.example` to `.env`. Set the project HTTPS URL and **publishable** key.
   Never use a service-role key or database password in the app.
4. Keep email confirmation enabled; configure the public Site URL / confirmation
   redirect in Supabase to a page you control. Users verify email in the browser,
   then return to the app and sign in using their password.
5. Run `npm run start:auth`. This disables the development session so you can test
   registration, sign-in, verification and session restoration.
6. Account A creates a wedding. In Settings, create an invitation code. Account B
   registers, signs in, selects Join wedding and enters the code. Each account can
   belong to one wedding, and each wedding has at most two accounts in this MVP.

The database uses RLS on all exposed tables. Wedding membership is created through
transactional RPCs only. Invitation tokens are 192-bit random values, stored as
SHA-256 hashes, expire after seven days and are consumed once. Generating a new
code invalidates the previous one. No message is sent automatically: sharing a
code uses the device share sheet when the user selects it.

Native auth tokens are stored in SecureStore, with chunked generation-based writes
to avoid large-value issues. Supabase refreshes access tokens using the refresh
session. Browser preview sessions are memory-only. Passwords are never stored by
the app. Development data uses a separate local AsyncStorage key and never syncs
to the real backend.

Optional Face ID / Touch ID is a **local app lock after account authentication**,
not a replacement for server authentication or a passkey. Enable it in Settings
on a real account and a supported device. The app locks after backgrounding and
on restart; it does not expose the data provider while locked. Cancel/failure
keeps it locked. The fallback signs out locally and clears this device's biometric
preference, allowing a new password sign-in. Actual Face ID and Keychain lifecycle
behavior still need physical-device acceptance testing.

## What's implemented

- Generic setup with optional partner names, date and target budget.
- Login, registration, password confirmation and verification guidance.
- Persistent native sessions; development-only local auto-session.
- Wedding creation, single-use partner invitation and tenant isolation SQL.
- Home recommendations and upcoming tasks.
- Full task creation, editing and confirmed deletion; stable partner assignment,
  status, priority, category, due date, notes, search, filters and sorting.
- Real-time task reloads and optimistic version checks to detect concurrent edits.
- Vendor cards: category, contact, quote, agreed price, status and notes.
- Budget target editing, commitments, paid totals, remaining/unallocated funds and overruns.
- Scheduled and paid payment records, including deposits, edited in place without duplication.
- Integer-agora arithmetic, stable operation IDs, transactional server validation and conflicts.
- Shared local storage updates preserve task and finance data together.
- Guest/family invitations with adult/child counts, partial RSVP, sides, groups, contact
  details, dietary notes and manual attendance tracking.
- Search/filters, invitation versus person totals, paged cloud loading and private access.
- Five functional navigation tabs plus protected editors and settings.
- Loading, error and retry states; restrained stack transitions.

## Still to build

Public RSVP links, document uploads, editable wedding names/date,
reminders, seating, import/export, account
deletion and password recovery. Do not publish for general use before recovery,
deletion, privacy/support pages and production acceptance checks are complete.

## Checks

```sh
npm run check
npm run export:web
npx expo install --check
```

Core tests exercise release bypass protection, empty/default setup, date/budget
validation, stable recommendation IDs, secure token chunking, interrupted writes
and concurrent storage operations. Task tests cover assignment from both partner
viewpoints, local data upgrades, deadline handling, combined filters and stale
edits/deletions. PostgreSQL migration tests use PGlite to exercise constraints,
RLS and column privileges against a minimal v0.1 schema fixture. CI runs typecheck, lint, tests and web export.
Production export always disables development bypass. Release builds also have
`__DEV__ === false`, independently preventing the bypass even with a bad flag.

`eas.json` separates development (local demo), preview (real auth) and production
(real auth). Set public Supabase configuration for preview/production in EAS.
No Supabase or Apple account has been provisioned and no live auth/RLS or biometric
test is claimed without those accounts and devices.

## Git source

Canonical repository: https://github.com/OfirKadosh/Beyachad

```sh
git clone https://github.com/OfirKadosh/Beyachad.git
cd Beyachad
npm ci
npm start
```

The original ZIP also includes `beyachad-history.bundle` for offline restoration:
`git clone beyachad-history.bundle Beyachad`. To connect that restored checkout to
GitHub, replace its bundle-path origin with the canonical URL above.

See `docs/ACCEPTANCE.md` for the next validation steps.

## Finance upgrade (v0.3)

Apply migration 003 before connecting this app version to an existing v0.2 backend.
Fresh projects apply every migration in filename order. Development workspaces add
empty vendor/payment arrays on load; there is no reset or deletion of existing tasks.
Rebuild an installed development client after adding the native expo-crypto module.

All prices/payment amounts are stored as integer agorot. Only booked suppliers'
agreed prices count as commitments; unselected quotes are not added to the total.
Planned and paid entries are the same records with a payment date, so marking paid
never creates a second expense. Remaining to pay includes the scheduled portion.
Price reductions and unbooking are blocked if they conflict with allocated payment
records; a supplier with any payment records cannot be deleted until those records
are handled explicitly. This is tracking only, not payment processing or bank access.

Financial writes use membership-checked RPCs with vendor row locks and version
checks. Stable UUIDs make create retries idempotent. Authenticated clients have
read-only direct access to finance tables; all writes must use these RPCs.
Offline full editing and hosted cross-device acceptance remain separate work.

## Guest invitations (v0.4)

Apply `202611030004_guests_rsvp.sql` after migrations 001–003. Existing local data
adds an empty guest array without resetting tasks, suppliers, payments or budget.
A guest record is one invitation/family with separate invited and confirmed adult
and child counts. Pending invitations have no confirmed people. Confirmed families
may be partial; their unconfirmed people count as not attending. Therefore invited
people = confirmed + pending + not attending. Dietary notes belong to the whole
invitation and should specify quantities/people, not imply every family member.

Manual RSVP only: no guest-facing links or messages are sent. Stable wedding sides
remain consistent for both partners. Matching phone numbers trigger an advisory,
not automatic deduplication, because multiple invitations may share a contact.
RPC-only writes validate membership, counts and expected versions. Create retries
use stable IDs; contacts and dietary notes are protected by read RLS. Cloud loading
pages through visible rows so server row caps do not silently truncate totals.

The remaining first-release work and later extras are listed in `docs/ROADMAP-he.md`.

SDK 58 compatibility patches are aligned in v0.4. Rebuild an existing native
development client before the physical-device acceptance pass.
