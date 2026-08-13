# Documentation Rules

Purpose: keep session boundaries, editor schema, document geometry, workflow states, and compatibility promises accurate for future contributors.

## Documentation Owners

- `app/documents/README.md` — app purpose, runtime, commands, environment, current techniques, and integration boundaries.
- `app/documents/SECURITY.md` — concise deployable security boundary and required security checks.
- `app/documents/docs/README.md` — local engineering authority, reading order, invariants, and change process.
- Topic files under `app/documents/docs/` — detailed implementation and verification rules.
- `docs/gracon-owned-pagination-architecture.md` — pagination milestones, measurement model, visual QA, and future break architecture.
- `.env.example` — configuration names, safe placeholders, comments, and production/development differences.
- Root `AGENTS.md` — cross-project ownership, service communication, and platform invariants.
- Backend README/docs — authoritative endpoint, permission, invitation, signature, audit, and storage contracts.

## Update Triggers

Update documentation in the same change when modifying:

- shared-session cookies, development compatibility, refresh, logout, or cross-app redirects;
- protected routes, same-origin document/auth/profile/signature proxies, or fixed server-only service origins;
- document permissions, sharing, invitation defaults, OTP, identity handoff, or acceptance;
- document status, finalisation, signing readiness, signing orchestration, evidence, or owner lock;
- TipTap schema, extensions, commands, stored JSON, migrations, or readonly policy;
- page geometry, margins, rulers, indents, tabs, line spacing, breaks, headers/footers, footnotes, tables of contents, or pagination;
- import/export support or a known fidelity limitation;
- private editor/profile image handling, links, uploads, or downloads;
- autosave ordering, version conflicts, cross-tab merge, comments pagination, or cleanup behavior;
- loading/recovery boundaries, scoped CSS ownership, accessibility, or breakpoints;
- dependencies, scripts, ports, environment variables, or release/security checks.

## Writing Standard

- Explain ownership and why the invariant exists, not just what a control does.
- Distinguish persisted state from transient UI and render-only measurement.
- Distinguish current implementation, legacy compatibility, known limitation, and future architecture.
- Use exact route, script, variable, status, schema attribute, and helper names from code.
- Document failure, conflict, retry, cancellation, cleanup, and ambiguous outcomes for async workflows.
- State backend authority for permissions, proof gates, signing, locking, and public verification.
- Do not include real or realistic credentials, tokens, invitation links, identifiers, private documents, or storage URLs.
- Do not promise parity, security, OCR, collaboration, or signing behavior that is not implemented and tested.
- Remove stale claims rather than adding contradictory notes.

## Schema And Compatibility Documentation

For a persisted editor change, document:

1. canonical node/mark/attribute shape and defaults;
2. supported legacy input and normalization behavior;
3. live editor rendering and command semantics;
4. readonly behavior;
5. autosave and versioning effect;
6. DOCX/PDF import behavior;
7. PDF/DOCX export behavior;
8. tests and known limitations.

Render-only DOM measurements and CSS offsets must be labeled as non-persisted.

## Environment Documentation

For each new or changed variable:

- update `.env.example`, never `.env`;
- explain purpose, expected format, and development/production behavior;
- use obviously fake placeholders;
- identify whether it is exposed by `NEXT_PUBLIC_*`;
- never put a secret in `NEXT_PUBLIC_*`;
- update security/deployment validation when the variable affects cookie, CSP, origin, or session policy;
- remind contributors to restart the dev server after public variable changes.

## Architecture Documentation

- Update the pagination architecture note when milestones, page measurement, break semantics, page chrome, outline, footnotes, table of contents, or export capture architecture changes.
- Update root `AGENTS.md` when ownership or cross-project communication changes.
- Update backend docs when the frontend requires a new authorization, readiness, invitation, image, signature, or audit contract.
- Do not document direct browser calls as acceptable; browser backend traffic belongs behind explicit same-origin route handlers.

## Documentation Checklist

- Relative links resolve.
- No reference points to the removed `agents/` directory.
- Runtime versions and scripts match `package.json`.
- Environment names match code and `.env.example`.
- New schema/layout behavior documents persistence and import/export parity.
- Security-sensitive flows identify backend authority and safe failure behavior.
- README, SECURITY, topic rules, and architecture notes agree.
- Each changed documentation file receives its own commit command under [`git.md`](./git.md).
