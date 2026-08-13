# Editor Canvas And Persistence Rules

Purpose: preserve TipTap schema integrity, document geometry, autosave ordering, Gracon-owned pagination, import/export parity, and resource cleanup.

## Sources Of Truth

Persisted:

- TipTap JSON content and schema attributes;
- normalized document layout metadata;
- document workflow/status and permissions from `api/documents`;
- image render URLs and persisted node dimensions;
- comments, signatures, evidence, and headers/footers from their backend contracts.

Render-only:

- DOM measurements and active-page calculations;
- automatic page seam offsets;
- ProseMirror decorations for tab rendering and formatting marks;
- selection-derived mixed/readout state;
- hover, drag preview, open popovers, and temporary export nodes.

Never serialize render-only state into document JSON.

## TipTap And Schema Rules

- TipTap owns content mutations. Use commands/transactions, never direct DOM content changes.
- Persisted editor features require schema-backed nodes, marks, or attributes before UI controls are added.
- Update registration, parsing, rendering, command behavior, read-only behavior, import, export, and tests together.
- Commands must preserve undo/redo semantics and selection where expected.
- Handle empty, node, multi-block, mixed-attribute, and read-only selections explicitly.
- Unknown or legacy content must degrade safely without crashing the editor.
- Do not silently strip supported content during load/save normalization.

## Autosave And Concurrency

- Skip autosave when canonical TipTap JSON and relevant metadata are unchanged.
- Debounce changes without losing the final update on blur/navigation when the product contract requires saving.
- Associate saves with document id and version/revision where available.
- An older response must never overwrite a newer local or server version.
- Document switches, session changes, permission changes, and unmount must cancel or invalidate pending work.
- A finalise, sign, lock, or access-revoked transition immediately blocks further editor writes.
- Conflicts must be surfaced and reconciled; never silently choose local content over an authoritative signed/locked state.
- Keep layout and content saves ordered when the backend contract couples them.
- Do not retry non-idempotent saves blindly after ambiguous failure.

## Document Layout

- Use `src/lib/document-layout.ts` as the normalization boundary for page size, orientation, margins, and shared CSS variables.
- Keep page size, margins, headers, footers, page numbers, paragraph indents, hanging indents, line spacing, tabs, and page-break attributes consistent across live editor, preview, PDF, DOCX, import, and persisted metadata.
- Use explicit units and conversion helpers; do not mix CSS pixels, points, twips, inches, or millimetres implicitly.
- Clamp invalid values to documented safe ranges without converting one user's layout into another silently.
- Layout defaults apply only when metadata is absent; preserve valid legacy values.
- Side rails, outline, toolbar, dialogs, and status panels must not change printable geometry.

## Rulers And Direct Manipulation

- Margin and paragraph markers preview optimistically during drag and persist once on release.
- Ruler commands write to normalized layout metadata or TipTap schema attributes through the existing autosave path.
- Do not create sidecar ruler state that disagrees with the document model.
- Mixed multi-block selection is explicit; never display one block's value as if it applies to all.
- Preserve left indent, first-line indent, hanging-indent constraints, and printable bounds.
- Tab stops remain typed (`left`, `center`, `right`, `decimal`), ordered, bounded, draggable, and import/export compatible.
- Keyboard and pointer cancellation must restore the pre-drag value.

## Gracon-Owned Pagination

Follow [`gracon-owned-pagination-architecture.md`](./gracon-owned-pagination-architecture.md).

- Measure the visible `.ProseMirror` surface through shared page-metrics/geometry helpers.
- Measurement may drive active page, page count, rulers, outline, and render-only offsets.
- Automatic offsets and gray page gaps never enter TipTap JSON.
- Manual `pageBreakBefore` is schema-backed and preserved across all supported paths.
- Oversized blocks remain in order and use render-only overflow marking until a deliberate line-level architecture exists.
- Export collapses live gray page gaps and retains exact page geometry.
- Do not reintroduce third-party runtime pagination.

## Print Preview And Export

- Use the visible Gracon canvas/export path; do not mount a hidden second editor merely for export.
- Preview and live editor render from the same persisted content/layout semantics.
- Temporary export hosts, clones, timers, object URLs, callbacks, and refs are short-lived and cleaned in `finally` and unmount paths.
- Ignore callbacks that arrive after cancellation or owner change.
- Repeated headers, footers, page numbers, page breaks, footnotes, signature evidence, and QR placement must match their supported export semantics.
- Export failure must not mutate the live editor or leave stale DOM behind.
- Large-document work must avoid synchronous repeated full-DOM capture where possible.

## DOCX And PDF Import

- Treat imported files and extracted metadata as untrusted and potentially malformed.
- DOCX conversion must preserve supported paragraph indents, hanging indents, tabs, list styles, line spacing, page breaks, footnotes, tables, links, images, and relevant layout metadata.
- PDF import is best-effort reconstruction, not perfect semantic recovery. Preserve page order and supported text/layout metadata without claiming OCR for scanned image-only pages.
- Validate file type, size, decompression/work limits, and parse failures.
- Convert external metadata into canonical schema attributes before TipTap JSON generation.
- Never persist temporary base64 or blob image data into the document.
- Import changes affecting schema require matching export parity or an explicit documented limitation.

## Links, Images, Tables, And Insert Actions

- Normalize links with `src/lib/editor-link.ts` before insertion or edit.
- Normalize image URLs with `src/lib/editor-image.ts`; upload local images through `api/documents`.
- Persist image width/height as TipTap attributes and preserve aspect ratio during corner resize unless the contract explicitly supports free resize.
- Image alt text remains editable and safe; filenames/URLs are not substitutes.
- Table cell background and border styling are schema-backed and exportable.
- Use the typed insert-action registry so labels, enabled states, and dispatch remain aligned.
- Quick insert actions use TipTap commands and remain undo-safe.
- Comments use schema/document anchors and bounded cursor pagination.

## Read-Only Integrity

- `src/lib/document-readonly.ts` centralizes finalised, signed, and locked immutability.
- Every new editing path, keyboard shortcut, paste/drop handler, image resize, table control, ruler drag, insert action, and autosave path must consult the same effective read-only state.
- Transition to read-only immediately after authoritative sign/finalise/lock success.
- Read-only mode may select, copy, navigate, inspect evidence, preview, and export only as authorized; it may not dispatch content mutations.
- Regression tests must cover every new workflow status or view mode.

## Performance And Cleanup

- Avoid full editor remounts for layout or workflow UI changes.
- Batch measurements and prevent ResizeObserver/layout feedback loops.
- Bound comments and ancillary history.
- Keep signing/outline/comment rails outside printable geometry.
- Clean timers, observers, listeners, export nodes, object URLs, editor instances, and async callbacks on every exit path.
- Profile before adding memoization or caching; cache keys must include document identity/version and never retain secret content across sessions.

## Editor Change Checklist

- Persisted and render-only state are separated.
- Schema, commands, parsing, rendering, autosave, readonly, import, export, and tests agree.
- Units and geometry use shared helpers.
- Stale saves/results cannot overwrite newer state.
- Finalise/sign/lock blocks all mutation paths.
- Temporary resources are cleaned after success, failure, cancellation, and unmount.
- Live editor, preview, PDF, DOCX, and legacy documents were considered.
- Long document and narrow-laptop behavior were verified.
