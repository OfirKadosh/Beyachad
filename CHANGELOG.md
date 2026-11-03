# Changelog

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
