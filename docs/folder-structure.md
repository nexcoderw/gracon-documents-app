# Folder Structure Rules

Purpose: keep editor UI, schema logic, document workflows, same-origin proxies, and pure conversion code in stable ownership boundaries.

## Current Layout

```text
app/documents/
  docs/                         project rules and architecture notes
  scripts/                      security and repository checks
  src/
    app/
      (protected)/documents/    authenticated document routes
      (protected)/templates/    authenticated template route
      api/                      same-origin session/profile/signing helpers
      invitations/[token]/      invitation review and acceptance
      login/                    development-compatible login handoff
      verify/                   public authenticity route
    api/                        typed browser clients
    components/
      editor/                   editor React components and scoped styles
      documents/                document React components
      pages/                    route-level page compositions
      layout/                   application shell
      shared/                   cross-feature components
      ui/                       generic primitives
    constants/                  stable application constants
    lib/
      auth/                     cookie/session policy helpers
      hooks/                    reusable hooks
      server/                   server-only proxy helpers
      tiptap/                   pure pagination/geometry helpers
      *.ts                      pure domain/import/export helpers
    store/
      editor/                   extensions, hooks, commands, and editor sync logic
      documents/                non-React document state helpers
    types/                      shared frontend types
  test/
    editor/                     pure editor policy and schema tests
    export/                     export conversion/parity tests
    import/                     import conversion tests
    verification/               session/security helper tests
```

## Placement Rules

- Put App Router entrypoints and same-origin handlers under `src/app/`.
- Keep route files thin; route-level compositions belong in `src/components/pages/<surface>/`.
- Put editor `.tsx` UI and colocated CSS modules in `src/components/editor/`.
- Put reusable document-list/card `.tsx` UI in `src/components/documents/`.
- Put TipTap extensions, command coordination, selection hooks, and editor sync code in `src/store/editor/`.
- Put pure TipTap geometry and measurement helpers in `src/lib/tiptap/`.
- Put pure import, export, layout, URL, readonly, and evidence transformations in `src/lib/`.
- Put server-only cookie/session proxy logic in `src/lib/server/`; never import it into a Client Component.
- Put typed browser requests in `src/api/`; individual components must not build service URLs or authorization headers.
- Put generic visual primitives in `src/components/ui/`; components containing document policy do not belong there.
- Colocate route/component-specific styles in `.module.css` files.

## Route And Proxy Rules

- Protected document/template routes must validate session state through the established protected flow.
- Invitation tokens belong only to the invitation route and its required requests; do not propagate them into unrelated navigation or storage.
- Public verification routes must remain independent from private document-loading clients.
- Local route handlers are trust boundaries: validate method, body, cookies, upstream response, redirect target, and safe error mapping.
- Auth/session/profile-image/signing proxy routes must use fixed upstream origins and server-only credentials/cookies.
- Do not put browser-only code, React state, or DOM access in route handlers.
- Do not add a proxy simply to bypass CORS or conceal an unclear service boundary.

## Editor Ownership

- React components render controls and dispatch commands; they do not own schema migration or export conversion.
- Extensions define persisted schema semantics and parsing/rendering behavior.
- Pure helpers normalize shared units and convert between document, DOCX, PDF, and CSS representations.
- Render measurement may inspect the live ProseMirror DOM but must not mutate persisted content.
- Autosave belongs in one coordinated path; new editor features must integrate with it rather than create sidecar persistence.
- Cross-tab share state and document metadata merging stay isolated from rich-text transaction logic.

## Dependency Direction

Preferred direction:

```text
route -> page component -> domain/editor component -> hook or typed API
editor component -> TipTap commands/extensions -> pure helpers
proxy route -> server helper -> fixed upstream service
import/export adapters -> shared schema/layout helpers
```

Avoid:

- API modules importing React components;
- UI primitives importing editor or document features;
- pure helpers reading browser storage or DOM globals;
- components writing tokens or document JSON directly to storage;
- export code depending on transient toolbar state;
- auth side effects inside generic editor components;
- circular barrels between components, store, and lib.

## CSS Ownership

- Keep `globals.css` limited to tokens, shared primitives, shell behavior, document paper geometry, and genuinely global editor rules.
- Do not add new global selectors for document cards, comments, signing progress, print preview chrome, or route-only surfaces.
- Paper/export geometry styles may be global only when the live editor and capture path intentionally share them.
- Modal or rail chrome must not alter printable geometry.

## New Feature Checklist

1. Identify persisted versus transient state.
2. Define schema/API types before UI wiring.
3. Place logic at the narrowest correct layer.
4. Add import/export support if the feature affects document content or layout.
5. Add read-only behavior for finalised, signed, and locked states.
6. Add cleanup for timers, observers, object URLs, temporary nodes, and requests.
7. Add focused tests in the matching test directory.
8. Verify narrow screens, keyboard use, error recovery, and long documents.
