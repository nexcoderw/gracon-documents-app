# File Structure Rules

Purpose: keep document frontend files typed, reviewable, cleanup-safe, and compatible with long-lived editor data.

## Required File Shape

- Start every source file with a concise purpose comment.
- Add JSDoc to every exported function, component, hook, public helper, and non-obvious exported type. Document parameters and returns where applicable.
- Use `const` by default; use `let` only for genuine reassignment.
- Do not use `any`. Narrow `unknown`, define interfaces, or use constrained generics.
- Delete dead code rather than commenting it out.
- Keep one exported React component per file. Tiny private render helpers may remain when they have no independent responsibility.
- Extract pure transformations, policy, and state machines before UI files become difficult to reason about.
- Avoid non-null assertions for environment variables, route params, DOM nodes, editor state, and network responses unless runtime validation proves the invariant.

## Naming

- React components: `PascalCase.tsx`.
- Component-matched CSS modules: `ComponentName.module.css`.
- Helpers and API modules: `kebab-case.ts`.
- Hooks: `useSomething.ts`.
- Tests: `*.test.ts` or `*.spec.ts`.
- Classes, types, interfaces, components: `PascalCase`.
- Functions and variables: `camelCase`.
- Immutable module constants: `UPPER_SNAKE_CASE`.

Retain established names when a rename would create unrelated churn; apply the convention consistently to new files.

## Type And Contract Rules

- Treat network, storage, imported document, and URL data as untrusted until validated.
- Keep API DTOs distinct from TipTap JSON, editor view state, and derived UI models.
- Use discriminated unions for document status, permissions, signing readiness, invitation gates, upload state, and async outcomes.
- Preserve `null`, missing, and empty distinctions from backend contracts.
- Model units explicitly in names or types: pixels, points, twips, inches, millimetres, and percentages are not interchangeable.
- Use stable schema attributes for persistent editor behavior; do not smuggle state through class names or DOM datasets.
- Keep legacy document parsing tolerant while all newly emitted content remains canonical.

## React And Next.js Boundaries

- Add `'use client'` only at the smallest component that requires browser state, DOM/editor access, or events.
- Never import server-only helpers, secrets, or cookie APIs into a Client Component.
- Effects must declare accurate dependencies and clean up timers, observers, subscriptions, object URLs, event listeners, and in-flight work.
- Reject or ignore async results when document id, version, permission, route, session, or component lifetime changed.
- Avoid copying editor or API props into state unless the component deliberately owns an editable draft and reconciles upstream changes.
- Use stable ids for documents, comments, collaborators, nodes, and rows; never use reorderable array indices as identity.
- Keep sensitive values out of React keys, DOM ids, `data-*` attributes, accessible labels, and URLs.

## Editor Module Rules

- UI components dispatch TipTap commands; direct DOM mutation must not change document content.
- Extensions own schema attributes, parsing, rendering, and commands for persistent features.
- ProseMirror decorations and temporary CSS variables may render derived behavior but must not be serialized.
- Transactions that should be undoable must enter TipTap history correctly.
- Selection-based commands must handle empty, multi-block, mixed-attribute, invalid, and read-only selections.
- Editor setup must not re-register equivalent extensions or recreate the editor unnecessarily.
- Do not capture a stale editor instance in long-lived callbacks.

## API And Async Rules

- Use typed API functions and the established auth retry/session recovery path.
- Support cancellation or stale-response rejection for searches, previews, imports, and document switching.
- Do not automatically retry non-idempotent share, invitation, finalise, signing, or lock mutations.
- Treat timeout after a mutation as uncertain; refetch authoritative state before retry.
- Autosave must skip structurally unchanged TipTap JSON and prevent an older response from overwriting a newer version.
- Surface conflicts explicitly; never silently discard remote edits or signed/read-only transitions.
- Map errors to safe UI copy without rendering arbitrary backend bodies.

## Resource Lifecycle

Every creator owns cleanup:

- `setTimeout` / `setInterval` -> clear on completion and unmount;
- `AbortController` -> abort superseded/unmounted work;
- object URL -> revoke after use;
- temporary export DOM -> remove in `finally` and unmount cleanup;
- observer/listener -> disconnect/remove;
- editor instance/plugin -> destroy/unregister;
- async callback -> ignore after cancellation or owner change.

Cleanup must run on success, failure, cancellation, route change, and unmount.

## Styling Rules

- Prefer colocated CSS modules for feature surfaces.
- Use existing tokens and variables; do not hardcode palette hex values in components.
- Do not add background gradients.
- Document paper/export remains white for fidelity; workspace and application chrome follow the established documents-app tokens.
- Keep computed inline styles limited to actual document geometry or user-selected values.
- Never let modal, rail, toolbar, or outline styling change printable dimensions.
- Maintain 44-by-44-pixel mobile targets and minimum 13-pixel rendered text.

## Comments And Diagnostics

- Comments explain why schema, security, cleanup, or compatibility constraints exist.
- Do not narrate obvious JSX or repeat function names.
- Never use `console.log` for production debugging.
- Client telemetry must be allowlisted and exclude tokens, invitation secrets, private identifiers, document content, evidence, and raw errors.

## Review Threshold

Split a file when it combines unrelated workflows or hides ownership between UI, persistence, schema, geometry, import/export, and security. Reviewability matters more than a fixed line count.
