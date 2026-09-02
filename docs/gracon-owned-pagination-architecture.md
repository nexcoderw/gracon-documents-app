# Gracon-Owned Pagination Architecture

This note defines how pagination, page navigation, document outline, and page
breaks work in the documents editor.

## Where Pagination Happens

The editable editor is **one continuous TipTap surface**. It has no page seams,
no spacers, and no per-page chrome: writing is never interrupted by layout work,
and no measurement error can accumulate while typing.

Pagination is resolved when the user asks for the document — print preview, and
the PDF download that goes through it. That surface is static, which is the only
place page surgery is safe: the paginator moves and splits rendered nodes, which
would corrupt the document model on a live ProseMirror view.

The preview is the contract. The user sees the paginated document, and the PDF is
captured from that same rendered surface, so the download cannot disagree with
the preview. DOCX skips the preview because Word repaginates a flow document
itself; only `pageBreakBefore` carries over.

Runtime third-party pagination packages must not be added to the editable
editor. `tiptap-pagination-plus` was evaluated: its table splitting requires
replacing the Table/TableRow/TableCell/TableHeader nodes with its own, which
would collide with `table-cell-style-extension.ts` and the DOCX attributes those
cells carry.

## Milestone Order

1. Measure pages from the live TipTap DOM and show active page/page count.
2. Build a document outline from measured heading positions.
3. Add schema-backed page-break-before attributes to paragraph-like nodes.
4. Teach print preview, PDF export, DOCX export, and DOCX import to preserve
   those page-break attributes.
5. Expose page-break-before commands in user-facing menus once export and
   import parity exists.
6. Render repeated page chrome from persisted header/footer/page-number
   metadata in live editor and print-preview/export paths.
7. Add schema-backed footnote references that remain editable, numbered in the
   canvas, recovered from DOCX footnote XML, and exported as real DOCX
   footnotes.
8. Add generated table-of-contents insertion from current heading nodes using
   normal editor schema content instead of a sidecar widget.
9. Split text blocks at line boundaries so a long paragraph continues on the
   next page instead of moving or overlapping page chrome.
10. Split tables at row boundaries with a repeated header row.
11. Move pagination out of the editable editor and into the download preview.
12. Keep section breaks, mixed orientation, and per-section margins as a later
    architecture change.

## Measurement Rules

Page metrics are derived from the rendered `.ProseMirror` element with
`src/lib/tiptap/tiptap-page-metrics.ts`. Measurement may drive UI such as a page
status chip, left-page ruler labels, and an outline rail. Measurement must not
write to document JSON.

Page geometry is normalized by `src/lib/tiptap/tiptap-page-geometry.ts`.
Live editor callers should use `createTiptapLivePageGeometry`, while PDF/export
callers should use `createTiptapExportPageGeometry`.

## One Forward Pass

`src/lib/tiptap/tiptap-page-breaks.ts` paginates a rendered surface in a single
walk through the document in reading order. Each unit — a block, a line inside a
block, or a table row — is measured at the moment it is reached, after every
earlier fix has already been applied. A placement is therefore always decided
against the true rendered position, which is what stops per-seam error from
compounding into a page-sized gap further down a long document.

The decision itself is pure and lives in
`src/lib/tiptap/tiptap-page-layout-plan.ts` (`resolveTiptapPlacement`): keep,
push, split, or overflow. Measurement lives in
`src/lib/tiptap/tiptap-page-layout-dom.ts`, which converts client rects into
document coordinates and finds the DOM point where a rendered line begins.

Two measurement rules are easy to get wrong and both produce visible gaps:

- Coordinates are measured against the frame that owns the page surfaces
  (`[data-document-export-root="true"]`), never `.ProseMirror`. Chrome between
  the two would shift every seam.
- Client rects are zoom-scaled while geometry is in CSS pixels, so every reading
  is divided by the measured scale.

## Splitting Rules

Paragraphs, headings, and blockquotes split at line boundaries: a spacer is
inserted before the first line that does not fit, so the rest of the paragraph
continues on the next page.

Tables split at row boundaries. `tiptap-table-pagination.ts` closes the table
before the row that no longer fits and opens a continuation table on the next
page, repeating the header row. This is real node surgery, so it must only ever
run on the static preview/export surface.

Images and signature blocks move as one unit. A unit that cannot fit in any
printable region — taller than a whole page and not splittable — stays in place
and is marked as render-only overflow.

The printable region keeps `PAPER_CONTENT_SAFETY_PX` of breathing room above the
footer and below the header, so a seam never leaves a line flush against page
chrome. The paged editor padding in `globals.css` adds the same value through
`--paper-content-safety`; the two must stay in sync.

`pageBreakBefore` on a block that already opens a printable region applies no
push. Pushing it again would leave a page-sized hole above content that was
already in the right place.

## Visual QA Rules

Pagination changes must be checked against the live editor canvas, print
preview, and export capture path before they are considered complete. The
primary visual contract is that editable text never renders through the
repeated page header, footer, page number, or gray inter-page gap.

Manual page breaks are the strongest page movement signal. A block with
`pageBreakBefore` must start at the next printable page region even when prior
automatic offsets already changed the effective document coordinate. Blocks that
cannot be split stay in document order and show the render-only overflow marker.

The minimum QA pass for page-seam work is:

1. Open a long document in the editor and confirm it is one continuous sheet
   with no seams, gaps, or page chrome interrupting the text.
2. Open print preview and inspect the first two seams: headings, paragraphs,
   lists, and page-break-before blocks must start below the header chrome and
   stop above the footer chrome.
3. Confirm a paragraph longer than the remaining space continues at the top of
   the next page, with no line drawn across the seam.
4. Confirm a table longer than a page continues as a second table on the next
   page with its header row repeated.
5. Download the PDF from the preview and confirm every page matches what the
   preview showed.
6. Check at least desktop and narrow laptop widths, because the preview zoom
   changes the rendered scale the paginator has to normalize.

## Page-Break Rules

Manual page breaks are represented in the editor schema, not as unmanaged DOM
nodes. `pageBreakBefore` on paragraphs and headings is the persisted form
because it survives autosave, import, export, and read-only rendering.

`insertPageBreakAtCursor` is the user-facing break: at the start of a block it
marks that block, and mid-block it splits the block first so the text after the
cursor opens the new page. It is bound to Ctrl/Cmd+Enter and exposed in the
insert menu as `Page break`; `toggleParagraphPageBreakBefore` remains available
for marking an existing paragraph.

Legacy standalone `pageBreak` and `sectionBreak` nodes should remain stripped
from imported or old TipTap JSON unless a future migration explicitly revives
them with full export and import parity.

## Document Aid Rules

Footnotes and generated tables of contents must remain schema-backed editor
content. Footnotes use inline `footnoteReference` atoms so note text survives
autosave, read-only rendering, DOCX import, and DOCX export. Static generated
tables of contents insert normal headings and paragraphs with paragraph layout
attributes; they are not live sidecar widgets and should not write measured page
state into document JSON.

## Export And Cleanup Rules

Print preview and export must use the visible Gracon canvas/export path. Hidden
export hosts must remain short-lived and must clean up DOM nodes, timers, refs,
and callbacks after completion or unmount.

Pagination features that affect export require pure regression tests under
`test/export` and import features require tests under `test/import`.
