# Gracon Documents App

Rich-text document workspace for the Gracon platform.

This application lets users create, organize, edit, share, sign, verify, and review documents. Identity stays in `app/app`; this app focuses on the document experience and redirects to the main app when login or identity verification is required.

## Overview

- Runtime: Next.js 16 + React 19 + TypeScript
- Default port: `4002`
- Styling: Tailwind CSS
- State: Zustand + sessionStorage
- Editor: Tiptap / ProseMirror
- Document domain: folders, templates, collaboration, invitations, signing, verification
- Browser titles: each route should use the `"{page or document name} | Gracon 360"` convention

## What This App Owns

- Document list, creation, rename, copy, delete, and DOCX/PDF import UX
- Rich-text editing and autosave experience
- Premium page setup dialog, persisted margins, and draggable ruler-based margin adjustment
- Share dialog, permission assignment, invitation review
- Share-dialog verification defaults are read from the user-owned settings in `api/auth`
- Signature workflow UI and signing progress
- Locked-document verification surface, including signed evidence, signature imagery, and QR verification placement
- One-call signing-readiness gating before opening the signing modal
- Same-origin signing BFF route that signs and records document signatures in one UI request
- Prefetched signing state with return-to-modal handoff after identity or certificate setup
- Public verify page for authenticity checks
- Invitation acceptance flow and proof-chain review

## Core Skills Needed

- Next.js App Router
- Tiptap / ProseMirror editor integration
- Complex state synchronization for document metadata
- Collaboration and permission UX
- Secure cross-app auth handoff

## Techniques Used

- Explicit same-origin Next.js BFF routes for document, auth, signature, invitation, asset, and export operations
- Server-side single-flight session refresh/upgrade helpers for auth and signature proxy routes
- Cross-app auth is moving to the shared Gracon session-cookie contract owned by `app/app` and the auth service. `app/documents` should validate server-side cookies through local route handlers and must not depend on JavaScript-readable refresh tokens in production.
- Profile avatars render through the same-origin `/api/profile-image` route with a reusable `UserAvatar` fallback. Do not place raw presigned S3 profile-image URLs directly in header or editor chrome DOM.
- Logout flows through the local documents `/api/logout` route first, then returns to the documents `/login` route so the user can sign back into the document workspace without an app/app login loop.
- The documents account dropdown links to `app/app` for Profile and Settings because account preferences remain identity-app owned.
- Zustand hydration from sessionStorage plus cookie-backed recovery
- A4-style editor work, autosave, versions, and signing states
- White default workspace background for documents, templates, and protected loading surfaces; the editor canvas owns its own neutral gray paper workspace
- Client-owned protected pages use `useDocumentTitle` for route titles because most document data is loaded through session-aware client state
- Reusable `DocumentLoadingState` keeps protected loading, editor loading, print-preview loading, and signing progress loading visually consistent with a document-specific loading visual and context-aware copy
- Editor and print-preview rendering are protected by scoped recovery boundaries so malformed imported content, images, tables, or extension failures do not crash the whole documents app
- High-risk UI surfaces are being moved out of `globals.css` into scoped CSS modules; signing progress, protected shell, templates page, document list helpers, document cards, and the comments drawer now own their styles locally
- Persisted document layout model powering paper margins, rulers, PDF, and DOCX export
- Preset-driven page setup with live printable-area preview for margin tuning
- Horizontal ruler handles for direct left/right margin editing on the page canvas
- Selection-aware ruler markers for active paragraph left-indent and first-line-indent readout
- Draggable paragraph ruler markers that write left-indent and first-line-indent back into editor content
- Explicit multi-block ruler feedback for mixed paragraph indentation selections
- Typed paragraph tab stops stored in editor content, shown on the ruler, editable from the ruler, and preserved in DOCX import/export
- Paragraph line spacing stored in editor content with Google Docs-style toolbar presets and DOCX export parity
- Ruler tab-stop popover for choosing left, center, right, or decimal tab alignment without memorizing shortcuts
- Draggable ruler tab-stop markers for repositioning existing tab stops without deleting and recreating them
- Live editor tab rendering uses ProseMirror decorations so tab characters remain copy/paste-safe while reflecting typed stop widths on canvas
- DOCX import uses the Mammoth-based conversion path with recovered paragraph indents, tab stops, and list styles before TipTap parsing
- PDF import uses PDF.js text extraction to rebuild editable TipTap content with page order, line grouping, indentation, line spacing, font size, and basic bold/italic metadata; scanned image-only PDFs require OCR before import
- Export parity tests for page margins, paragraph indents, hanging indents, line spacing, and tab-stop conversion
- Invitation gate with OTP and identity-proof return flow
- The share dialog fetches `/api/v1/users/preferences` through the same-origin documents proxy and uses `defaultDocumentInviteVerifications` only as a UI default. Login is still always required, and `api/documents` remains the enforcement point for document invitation access.
- Signing readiness checks from `api/documents` so the UI can route users to login, identity verification, certificate setup, or signing without extra probing calls
- Signing modal submits to a local BFF route that calls `api/signature` and then records the result in `api/documents`, reducing partial browser-side failure states
- Signing actions reuse one readiness state across the header, progress panel, and modal return flow
- Signing progress belongs in the document body's right-side rail so the top ruler, left ruler, paper canvas, and export geometry are never shifted by workflow UI; the rail is fixed to the visible canvas area and must not move when document content scrolls
- After a signer completes signing, the editor is made read-only immediately in memory without a page reload
- Signed, finalised, and locked editor immutability is centralized in `src/lib/document-readonly.ts` with regression coverage so future editor changes cannot accidentally re-enable editing
- Owner lock is a confirmed action, not an accidental one-click mutation
- Signed and locked documents render signing evidence in editor and print preview, with QR verification centered at the bottom of the signed page surface
- Print preview now uses the stable Gracon-owned canvas/export path; third-party runtime pagination has been removed while Gracon-owned pagination is implemented
- Print preview owns a cleanup audit for stale export roots: temporary export hosts, readiness timers, and DOM refs must be cleared when saving finishes or the preview unmounts
- Gracon-owned page break and pagination architecture is documented in `docs/gracon-owned-pagination-architecture.md`
- Live editor pagination metrics now derive active page, page count, per-page ruler pages, and heading outline data from the rendered TipTap document without writing measurement state into document JSON
- Live editor pagination uses one shared layout engine (`src/lib/tiptap/tiptap-page-layout-plan.ts`) for the editor and export clones, so page seams land in the same place on canvas, in print preview, and in the exported PDF
- Live editor pages use a Google Docs-style gray gap between page surfaces, while PDF export keeps page gaps collapsed to preserve print geometry
- Text blocks split at line boundaries: a paragraph that no longer fits continues on the next page instead of running through the footer, page gap, and next header. Lists paginate per item; tables, images, and signature blocks still move as one unit
- Live pagination spacers are ProseMirror widget decorations, so page layout never reaches autosave, copy/paste, DOCX export, or read-only rules; export clones receive the same spacers as inert DOM elements
- Page seams keep a safety margin above the footer and below the header (`PAPER_CONTENT_SAFETY_PX` / `--paper-content-safety`), so a break never leaves text flush against page chrome
- Applied page offsets are verified against the absolute coordinate they were planned for, and corrected cumulatively in document order, so per-seam error cannot compound into a visible gap further down a long document
- Tables paginate per row, so part of a table can sit on one page and the rest on the next; rows are offset by cell padding because a spacer between table rows would be pulled out of the table by the HTML parser
- A page break on content that already starts a page adds no extra space
- Blocks that genuinely cannot be paginated — content taller than one printable page — are still marked as render-only overflow without mutating TipTap JSON
- `Ctrl/Cmd+Enter` inserts a Google Docs-style page break at the cursor, splitting the block so the text after the cursor opens the new page
- The editor includes a collapsible document outline generated from heading positions so long documents can be navigated before schema-backed page breaks are introduced
- Insert-menu comment creation is wired through the existing comments drawer and selected-text anchors while comment history remains bounded and cursor-paginated
- Page-break-before is now schema-backed on paragraph-like nodes, exposed through the insert menu, visible in formatting-mark mode, and preserved through live layout, PDF capture, DOCX export, and DOCX import
- Live editor and print-preview page chrome render repeated headers, footers, and page numbers from the same persisted layout metadata consumed by export
- Footnote references are schema-backed inline editor nodes, exposed through the insert menu, rendered as numbered references, recovered from DOCX footnote XML on import, and exported as real DOCX footnotes
- The insert menu can generate a static table of contents from current heading nodes using the same schema-backed paragraph indentation and tab-stop model as the ruler/export path
- Cross-tab share activity refresh and document metadata merge patterns
- Typed insert-menu action registry so menu labels, enabled states, and editor command dispatch stay aligned while features are implemented incrementally
- Quick insert actions for date/time and common special characters using undo-safe TipTap insert commands
- Selection-aware link insertion and editing with safe URL normalization before links enter the TipTap document model
- Schema-backed table cell styling for white/black default tables, editable cell background colors, per-side borders, and DOCX export preservation
- Secure hosted-image insertion from URL or local upload through `api/documents`, with private S3 storage, preview, accessibility metadata, and base64 image storage blocked
- Resizable editor images with persisted TipTap width/height attributes, aspect-ratio-safe corner handles, and polished canvas feedback

## Main Areas

```text
src/app/
  (protected)/documents/   list and protected document workspace routes
  (protected)/templates/   template entry
  api/                     local auth/signature helper routes
  invitations/[token]/     invitation review and acceptance
  login/                   minimal local login handoff
  verify/                  public authenticity page
components/
  editor/                  editor React components only: header, toolbar, sharing, signing, comments
                            shared editor loading state lives here
  documents/               document React components only: document cards and signature strip
  pages/
    auth/login/
    documents/
    invitations/
    verify/
  layout/
  shared/
  ui/
api/
  documents.api.ts
  folders.api.ts
  invitations.api.ts
  signature.api.ts
  templates.api.ts
  client.ts
  auth-retry.ts
lib/
  store/
  hooks/
  hooks/useDocumentTitle.ts client-side route title helper for protected pages
  document-layout.ts       shared paper-layout normalization and css-var helpers
  editor-image.ts          safe editor-image URL normalization helper
  editor-link.ts           safe editor-link URL normalization helper
  import-docx-layout.ts    DOCX paragraph-layout import conversion helpers
store/
  editor/                  editor hooks, TipTap extensions, share sync, and other non-React-component editor logic
  documents/               document-domain helpers that are not React components
test/
  export/                  pure layout/export conversion regression tests
  import/                  pure DOCX/PDF import-layout conversion regression tests
  editor/                  pure editor helper regression tests
```

## Folder Structure

```text
app/documents/
  docs/          project architecture and execution rules
  src/
    app/
    api/
    components/
    store/
    lib/
    constants/
    types/
  public/
  test/
  package.json
```

## AI Agent Rules

Project-local engineering guidance lives in [`docs/README.md`](./docs/README.md).

Read that guide before changing the editor, document canvas, page setup, rulers, print preview, export, import, invitations, signing, locking, session handoff, or public verification surfaces. It defines the required reading order, ownership boundaries, parity requirements, verification gates, and Git handoff rules for this frontend.

## Security Hardening

Read [SECURITY.md](./SECURITY.md) before changing session handoff, invitation
acceptance, signing, profile images, editor image handling, public verification,
same-origin proxy routes, CSP headers, or app security workflow checks.

## Recent Production Notes

- The default app workspace background is intentionally a soft off-white to reduce glare. Do not reintroduce the old purple radial/grid page background on documents, templates, login, or protected loading screens. Actual document paper and export/print surfaces should remain white for fidelity.
- Keep route titles explicit. Documents list should be `Documents | Gracon 360`, templates should be `Templates | Gracon 360`, and the editor should use the loaded document title.
- Prefer `DocumentLoadingState` for editor/document loading surfaces instead of creating new ad hoc spinners. Give each usage clear context-specific `message` and `detail` text.
- Keep risky renderers behind surface-level error boundaries. The live editor and print preview must recover independently and should remount only the failed surface.
- Prefer scoped CSS modules for route/component-specific styling. `globals.css` should be reserved for design tokens, shared primitives, app shell rules, editor document geometry, and truly global utilities.
- Shared `Button`, `Input`, `Card`, and loader presentation is component-owned; route metadata and indexing rules live in [`docs/seo.md`](./docs/seo.md).
- Document cards are styled through `DocumentCard.module.css`; do not add new `doc-card` globals.
- Document comments are styled through `DocumentCommentsPanel.module.css`; do not add new `doc-comments` globals.
- Signing progress is styled through `DocumentSigningProgressPanel.module.css`; keep it independent from document canvas geometry.
- Print preview shell styling is scoped through `DocumentPrintPreviewDialog.module.css`; keep modal chrome out of `globals.css`.
- Pagination must remain Gracon-owned in the live editor, print preview, and persisted document model. Third-party pagination packages may be studied externally, but should not be reintroduced into runtime dependencies.
- Hidden print-preview/export renderers must be treated as short-lived resources. Any new async render path must cancel timers, ignore callbacks after unmount, remove temporary DOM hosts, and keep object refs from pointing at detached nodes.
- Print preview should not mount hidden editors for export. Export from the visible Gracon canvas unless a future worker or server renderer replaces it.
- Autosave skips unchanged TipTap JSON payloads so long documents do not repeatedly upload identical content.
- Comment loading is intentionally bounded and cursor-paginated; the comments drawer loads older review history only on demand.

## Local Commands

```bash
npm install
npm run dev
npm run check:security
npm run build
npm run lint
npm run test
```

## Environment Notes

Key variables:

```env
NEXT_PUBLIC_DOCS_URL=http://localhost:4002
NEXT_PUBLIC_APP_URL=http://localhost:4000
AUTH_API_URL=http://localhost:3000/api/v1
DOCUMENTS_API_URL=http://localhost:3005/api/v1
SIGNATURE_API_URL=http://localhost:3002/api/v1
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=lax
AUTH_ACCESS_TOKEN_TTL=15m
AUTH_REFRESH_TOKEN_TTL=1d
AUTH_REFRESH_ROTATION=true
AUTH_REUSE_DETECTION=true
DOCUMENTS_USE_MAIN_APP_LOGIN=false
ALLOW_DEV_READABLE_AUTH_COOKIES=true
NEXT_PUBLIC_DOCUMENTS_USE_MAIN_APP_LOGIN=false
NEXT_PUBLIC_ALLOW_DEV_READABLE_AUTH_COOKIES=true
```

The three backend origins are server-only. Browser requests remain on port
`4002` under explicit `/api` and `/api/v1` route handlers. Editor image storage
variables belong in `api/documents`, not this frontend app.
For production, the auth cookie domain should be the parent domain, for example
`.gracon360.com`, so `app.gracon360.com` login can be reused by
`documents.gracon360.com`. Real session credentials should be `HttpOnly` and
validated server-side; `session_active` is only a non-sensitive hint.
Keep `DOCUMENTS_USE_MAIN_APP_LOGIN=false` and readable development cookies
enabled locally. In production, enable main-app login, disable readable auth
cookies, and let the server route handlers own shared cookie validation.

## Integration Boundaries

- Uses fixed local BFF routes for every browser-to-`api/documents` operation
- Uses fixed local BFF routes for auth/session recovery and signature endpoints
- Uses local proxy routes for auth-owned user preferences so the documents frontend does not call `api/auth` directly from browser code
- Uses local `/api/session` to validate the shared Gracon session server-side before loading protected document routes. Missing production sessions should redirect to `app/app` login, while the local documents login remains available for development compatibility.
- Uses local `/api/logout` to revoke the current refresh session when available and clear shared document-visible session cookies before returning to the documents login route.
- Redirects to `app/app` for login and identity verification
- Should not host its own standalone identity-verification UI now

## Important Rules

- Use hard navigation when jumping to `app/app`
- Do not add new production code that requires reading refresh tokens from `document.cookie`. Shared auth must be validated through server-side route handlers.
- Keep the existing local development login/readable-cookie method available for developer workflows. Production should use `NEXT_PUBLIC_DOCUMENTS_USE_MAIN_APP_LOGIN=true` and server-owned cookies from `app/app`.
- Keep logout unified. Document UI should call `logoutFromDocuments()` so local documents cookies and the shared session are cleared before returning to `/login`.
- Keep document permissions and signing state separate in the UI
- Reflect the backend workflow correctly: finalise, sign, then owner lock
- Keep page layout data consistent across editor rendering and export
- Treat invitation review as a security-sensitive flow, not a simple share acceptance
- Treat user preference defaults as preselection only. Never skip backend invitation gates just because the UI default is `No extra verification`.

## Contribution Checklist

- Verify permission behavior before changing document actions
- Keep editor changes isolated from auth behavior unless the flow truly crosses apps
- Keep persisted editor schema data separate from render-only pagination measurements and DOM offsets
- Make autosave and cross-tab updates safe against stale responses, out-of-order completion, and signed/read-only transitions
- Keep `components/editor` and `components/documents` for `.tsx` UI components; put editor/document `.ts` hooks, extensions, sync helpers, and pure state helpers under `src/store/editor` or `src/store/documents`
- Test invitation, share, signing, and public verify flows after document-domain changes
- Keep signed/locked read-only tests current whenever document statuses, permissions, or editor view modes change
- Keep the comments drawer cursor-paginated. Do not reintroduce a full unbounded comment-history fetch in the editor.
- Run `npm run check:security`, `npm run lint`, `npm run test`, and `npm run build` before handoff
