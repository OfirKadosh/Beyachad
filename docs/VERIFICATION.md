# Verification · 2026-11-03

Passed on the delivered source:

- `npm run check`: TypeScript, Expo ESLint, six Node core tests.
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
physical iPhone testing. Live Supabase registration, RLS, cross-device realtime,
invitation concurrency and native biometric/signing behavior remain unverified
until an owned backend project and physical device are configured.

The browser runner is an environment-specific QA helper and is not shipped as a
project dependency. Portable core tests and GitHub CI are included in the source.
