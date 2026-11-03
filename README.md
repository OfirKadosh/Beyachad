# ביחד · Beyachad

A private, Hebrew-first wedding planner for two partners. Expo SDK 58, React Native,
TypeScript and Expo Router. Version 0.1.0 is the foundation, not a finished wedding
management product.

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
2. Run `supabase/migrations/202611030001_foundation.sql` once in its SQL editor.
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
- Home recommendations, task creation/completion, open-task filtering.
- Real-time task reloads and optimistic version checks to detect concurrent edits.
- Five navigation tabs and settings; honest empty/future states for incomplete modules.
- Loading, error and retry states; restrained stack transitions.

## Still to build

Full budget/payments, guests/RSVP, supplier CRUD, documents, task deadlines and
assignment, editable wedding details, reminders, seating, import/export, account
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
and concurrent storage operations. CI runs typecheck, lint, tests and web export.
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
