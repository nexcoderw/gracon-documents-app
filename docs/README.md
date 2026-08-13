# App Documents Engineering Guide

Purpose: define the project-local rules for changing Gracon's document workspace without weakening document access, invitation proofs, shared-session boundaries, signing integrity, editor persistence, or import/export fidelity.

## Authority And Reading Order

Read the root `AGENTS.md`, [`../SECURITY.md`](../SECURITY.md), this file, and then every topic file relevant to the change.

1. [`folder-structure.md`](./folder-structure.md) — route, component, editor, store, helper, proxy, and test ownership.
2. [`file-structure.md`](./file-structure.md) — file shape, types, client/server boundaries, exports, and scoped styling.
3. [`security.md`](./security.md) — document access, invitation secrets, sessions, assets, public verification, and browser exposure.
4. [`auth-session.md`](./auth-session.md) — production shared sessions, development compatibility, refresh, logout, and cross-app redirects.
5. [`editor-canvas.md`](./editor-canvas.md) — TipTap schema, autosave, layout, pagination, rulers, import/export, images, and cleanup.
6. [`signing-invitations.md`](./signing-invitations.md) — sharing, invitation gates, readiness, finalisation, signing, evidence, and owner lock.
7. [`ui-design.md`](./ui-design.md) — document workspace, loading/recovery, responsive behavior, accessibility, and feedback.
8. [`testing.md`](./testing.md) — required security, regression, lint, test, build, and manual verification.
9. [`documentation.md`](./documentation.md) — documentation ownership and update triggers.
10. [`git.md`](./git.md) — mandatory one-file-per-commit handoff format.

Read [`gracon-owned-pagination-architecture.md`](./gracon-owned-pagination-architecture.md) for any change involving page measurement, automatic or manual breaks, outlines, repeated page chrome, footnotes, table of contents, print preview, or export capture.

## Product Boundary

`app/documents` owns:

- document, folder, template, sharing, invitation, editor, preview, and export UX;
- document-specific session recovery through same-origin route handlers;
- signing readiness presentation and the local signing orchestration endpoint;
- public authenticity presentation without private document disclosure;
- responsive document workspace, loading, and recovery behavior.

It does not own:

- identity registration, login authority, or identity-verification UI;
- JWT issuance or document permission enforcement;
- invitation proof enforcement;
- personal signing keys or private certificate material;
- S3 credentials or direct private-object access;
- cryptographic validity decisions.

Canonical communication:

```text
browser -> api/documents
browser -> app/documents same-origin route handlers -> api/auth or api/signature
app/documents -> hard navigation to app/app for identity-owned flows
```

Do not add browser-direct calls to `api/auth` for session/business behavior or to `api/signature` for signing operations already owned by the local orchestration route.

## Core Invariants

- `api/documents` is authoritative for document access, permissions, invitation gates, workflow state, and signature recording.
- `app/app` and `api/auth` own identity and production shared-session issuance.
- TipTap JSON and normalized document layout metadata are persisted truth; DOM measurements and pagination offsets are render-only.
- Finalised, signed, and locked documents remain read-only through centralized policy, regardless of visible controls.
- Finalise, sign, and owner lock are distinct transitions and must never be collapsed.
- Import, live editor, preview, PDF, and DOCX paths preserve the same schema-backed semantics.
- Private images use stable `api/documents` render URLs; document JSON never contains base64 image payloads.
- User preference defaults may preselect invitation options but never bypass backend gates.

## Required Change Process

Before editing:

1. Identify the data owner, route, editor extension, component, helper, proxy, and backend contract involved.
2. Classify state as persisted document data, transient UI state, server session state, or render-only measurement.
3. Trace hydration, autosave, cross-tab updates, retries, cancellation, cleanup, and read-only transitions.
4. Determine access level, invitation gates, signing status, and whether the backend must reject stale state.
5. Identify import/export and legacy-document compatibility requirements.
6. Choose automated tests before changing shared geometry, schema, or security helpers.

During implementation:

- mutate document content only through TipTap commands or deliberate document API operations;
- keep layout normalization and conversion pure where possible;
- reject stale async results and clean up temporary resources;
- make permission, read-only, loading, missing, conflict, offline, and failure states explicit;
- preserve keyboard, screen-reader, reduced-motion, and narrow-screen behavior;
- never turn a frontend affordance into assumed authorization.

Before handoff:

- run every required command in [`testing.md`](./testing.md);
- verify Markdown links and stale `agents/` references for documentation moves;
- update the README, security guide, architecture note, tests, and environment example when their contracts changed;
- provide one quoted `git add` and one Conventional Commit command for every changed, added, or deleted file;
- never execute Git commands.

## Non-Negotiable Rules

- Never reintroduce standalone identity verification in this app.
- Never read production refresh tokens from client JavaScript.
- Never trust `session_active`, client roles, route presence, or hidden buttons as authorization.
- Never store invitation tokens, access tokens, refresh tokens, private identifiers, private keys, or base64 documents/images in persistent browser storage.
- Never mutate editor content through direct DOM operations.
- Never write measured page state or CSS offsets into TipTap JSON.
- Never re-enable editing after a finalised, signed, or locked transition.
- Never mount a hidden second editor solely to export.
- Never add unbounded comments, versions, invitations, or activity loading.
- Never optimistically report signing or owner lock success before authoritative confirmation.
- Never run Git commands.

## Conflict Rule

If local documentation conflicts with root `AGENTS.md`, follow the stricter security, privacy, validation, immutability, and service-boundary rule. A deliberate architecture change must update both locations.
