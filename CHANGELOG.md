# Changelog

## 0.5.0 — Meetings and reminders

- Zoned meeting CRUD, duration, supplier links, ownership, status and lead-time selection.
- DST gap/repeated-time validation and participant-aware overlap advisories.
- Personal reminder center combining meetings, task deadlines and unpaid installments.
- Opt-in native local notifications with generic content, bounded scheduling and reconciliation.
- Cleanup/version protection for supplier unlink, logout/reset and stale asynchronous schedules.
- Add migration 005, meeting SQL/time-zone tests and fake-adapter notification tests.

Requires a rebuilt native development client for expo-notifications. Web has an
in-app list only. Real-device delivery and hosted background synchronization are
not claimed; local schedules refresh on app open/foreground/live sync.

## 0.4.0 — Guest invitations and manual RSVP

- Create/edit/delete invitations for families, couples or individuals.
- Track invited and confirmed adults/children, including partial confirmations.
- Store side, group, contact, phone, dietary requirements and notes privately.
- Add RSVP/side/group filters, search, phone-duplicate advisory and Home totals.
- Preserve drafts on stale changes, use idempotent create IDs and confirmed deletion.
- Page through cloud rows and preserve all existing local workspace modules.
- Add migration 004, count/permission tests and a Hebrew remaining-work roadmap.
- Align recommended Expo SDK 58 compatibility patches.

Existing Supabase projects apply migration 004 after 003. RSVP is manual; public
links, messaging, Excel and seating are future extensions.

## 0.3.0 — Budget and vendors

- Create/edit/search vendor cards with contact details, category, quote, agreed cost and status.
- Set a shared budget target and track commitments, paid amounts, remaining funds and overruns.
- Record planned payments/deposits and mark them paid in place; edit/delete with confirmation.
- Use integer agorot and idempotent creation IDs; transactional RPCs prevent over-allocation.
- Protect supplier price/status changes, paid records, stale updates and tenant isolation.
- Preserve tasks and finance records through one shared local-storage write queue.
- Add SQL migration 003 and finance domain/permission tests.

Existing Supabase projects must apply migration 003 after 002. Document uploads and
RSVP management remain future stages. Rebuild existing native development clients
for the newly added expo-crypto module.

## 0.2.0 — Task management

- Create, edit and confirm deletion of shared tasks.
- Assign to either stable wedding member slot or both; Mine is viewer-specific.
- Add status (to do / in progress / done), priority, category, deadline and notes.
- Search titles/notes, combine filters and sort by deadline or priority.
- Show overdue work and the next three open tasks on Home.
- Preserve editor drafts during conflicts; prevent stale updates/deletions using versions.
- Upgrade local v0.1 tasks automatically; additive SQL migration preserves server data.
- Add PostgreSQL migration/RLS/privilege tests and task-domain tests.

Existing hosted databases require the second SQL migration before using this version.
Full budget, guest and supplier management remain future stages.

## 0.1.0 — Foundation

Generic wedding setup, auth/session infrastructure, development workspace,
recommendations, simple tasks, partner invites and native biometric-lock foundation.
