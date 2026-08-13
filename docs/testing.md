# Testing Rules

Purpose: require evidence that session handoff, document access, editor persistence, import/export parity, invitation proofs, and signed-document immutability remain correct.

## Required Commands

Run from `app/documents/` before handoff:

```bash
npm run check:security
npm run lint
npm run test
npm run build
```

For dependency or release-sensitive work, also run:

```bash
npm audit --audit-level=high
```

Deployment validation requires real production environment values:

```bash
CHECK_DEPLOY_ENV=true npm run check:security
```

Do not run deployment validation with invented values and report it as proof. Documentation-only changes still require the four standard project commands plus Markdown link and stale-reference checks.

## Test Selection

- Pure schema, layout, readonly, URL, import, export, pagination, and formatting logic: focused Node tests.
- React/editor lifecycle or keyboard behavior: component/integration tests when the behavior cannot be isolated, plus manual verification.
- Route handler/session changes: proxy/helper tests covering cookies, fixed origins, redirects, refresh concurrency, and error mapping.
- Invitation/signing changes: state-machine tests plus authorized, denied, stale, duplicate, timeout, and return-flow verification.
- Visual geometry changes: pure conversion tests plus live editor/preview/export visual QA.

Never use real auth, signature, S3, email, or production document services in frontend unit tests.

## Required Regression Areas

1. Finalised, signed, and locked read-only policy.
2. Page size, margins, headers/footers, indents, hanging indents, line spacing, tabs, and manual page breaks.
3. DOCX import/export and PDF import behavior for every supported schema feature.
4. Editor link and hosted-image normalization.
5. Autosave unchanged-payload skipping, ordering, conflict, and stale-response behavior.
6. Gracon-owned page geometry, gaps, offsets, overflow markers, and cleanup.
7. Invitation login, OTP, identity return, acceptance, and safe redirect behavior.
8. Signing readiness, finalise, orchestration, immediate readonly transition, evidence, and owner lock.
9. Session proxy, refresh single-flight, logout, cookie policy, and development/production split.
10. Bounded comments, cross-tab share state, and document metadata merging.

## Editor And Autosave Matrix

- empty, legacy, malformed-but-recoverable, and long document;
- undo/redo for every new command;
- empty, single-block, multi-block, mixed, node, and read-only selection;
- unchanged JSON skip;
- rapid edits with out-of-order save completion;
- document switch or unmount during pending save;
- access revoked, finalised, signed, or locked during editing;
- stale version/conflict response;
- offline/network recovery without silent overwrite;
- editor error boundary remount without app-wide crash.

## Layout, Pagination, And Export Matrix

- default and custom page sizes/orientation/margins;
- invalid/legacy layout normalization;
- paragraph left/first-line/hanging indents and mixed selection;
- left/center/right/decimal tabs and drag reposition;
- line spacing, lists, tables, images, links, page breaks, footnotes, table of contents;
- repeated headers, footers, and page numbers;
- whole-block seam adjustment and oversized-block overflow marking;
- live gray gap absent from export;
- preview/export cancellation, failure, unmount, and temporary-resource cleanup;
- signed evidence and QR placement;
- desktop and narrow-laptop canvas geometry.

## Import Matrix

- valid DOCX with supported layout/content features;
- legacy DOCX without new attributes;
- malformed/oversized archive and unsupported relationships;
- valid text PDF with page order, indentation, spacing, size, and emphasis;
- scanned image-only PDF with an honest OCR-required outcome;
- unsafe links/images rejected or normalized;
- parse failure leaves no object URL, timer, worker, or partial document mutation;
- imported schema round-trips through save/export for supported features.

## Auth And Security Matrix

- production server-owned cookies and development compatibility mode;
- missing, malformed, expired, revoked, and reuse-detected session;
- `session_active` hint with no valid backend session;
- concurrent refresh/upgrade and complete waiter rejection on failure;
- safe relative return and rejection of absolute/protocol-relative/login/logout destinations;
- hard navigation to identity-owned login/verification/profile/settings;
- logout clears session, editor, cached document, and transient sensitive state;
- profile/editor image path never exposes raw presigned storage URLs;
- CSP/security baseline rejects forbidden browser storage and unsafe configuration.

## Invitation And Signing Matrix

- invite valid, expired, revoked, consumed, wrong-recipient, already accepted, and unavailable;
- every required combination of login, OTP, and identity proof;
- UI defaults cannot bypass backend gates;
- duplicate acceptance and timeout/uncertain result;
- readiness states for login, identity, certificate, unavailable, and ready;
- readiness invalidation after document/session/certificate change;
- finalise against current and stale versions;
- signing duplicate submit, timeout, partial/uncertain response, and authoritative reconciliation;
- immediate readonly after finalise/sign/lock;
- owner and non-owner lock affordances with backend enforcement;
- evidence/QR parity in editor, preview, export, and public verification.

## Responsive And Accessibility Matrix

Verify at minimum:

- 320px mobile;
- 768px tablet;
- 1024px laptop;
- 1440px desktop;
- 200% browser zoom;
- keyboard-only navigation;
- reduced-motion preference;
- screen-reader labels/status announcements.

Check editor toolbar, menus, dialogs, canvas scroller, page setup, rulers, outline, comments, signing rail, lists, cards, invitation review, public verification, focus restoration, touch targets, and overflow.

## Documentation Verification

- Every relative Markdown link resolves.
- No README or source points to the removed `agents/` directory.
- `docs/README.md` links every rule and relevant architecture note.
- Runtime versions, scripts, environment names, and file paths match the repository.
- Git examples follow [`git.md`](./git.md).

## Handoff Evidence

Report commands and results, focused tests, manual checks, skipped checks and reason, remaining risks, exact files changed/added/deleted, and one-file-per-commit commands without executing Git.
