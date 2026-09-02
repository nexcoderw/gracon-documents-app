# Gracon-Owned Pagination Architecture

This note defines the safe path for pagination, page navigation, document
outline, and later page-break work in the documents editor.

## Current Boundary

The live editor is one TipTap/ProseMirror document surface. Gracon owns the
paper chrome, page metrics, rulers, print preview, PDF export, and DOCX export
around that surface. Runtime third-party pagination packages must not be added
back to the editable editor.

Signed, finalised, and locked documents must continue to use the centralized
read-only rules in `src/lib/document-readonly.ts`. Pagination UI may read the
document DOM, but it must not re-enable editing or mutate content outside TipTap
commands.

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
10. Keep table row splitting, section breaks, mixed orientation, and
    per-section margins as a later architecture change.

## Measurement Rules

Page metrics are derived from the rendered `.ProseMirror` element with
`src/lib/tiptap/tiptap-page-metrics.ts`. Measurement may drive UI such as a page
status chip, left-page ruler labels, and an outline rail. Measurement must not
write to document JSON.

Page geometry is normalized by `src/lib/tiptap/tiptap-page-geometry.ts`.
Live editor callers should use `createTiptapLivePageGeometry`, while PDF/export
callers should use `createTiptapExportPageGeometry`.

## One Layout Engine, Two Renderers

`src/lib/tiptap/tiptap-page-layout-plan.ts` is the only page layout engine. It
is pure: it takes page geometry plus measured blocks — and, for text blocks, the
rendered line boxes inside them — and returns per-block offsets, line spacers,
and overflow flags. All pagination behavior belongs there, so it stays unit
tested and cannot drift between surfaces.

Measurement is shared by `src/lib/tiptap/tiptap-page-layout-dom.ts`, which reads
block rects, groups client rects into rendered lines, and resolves the DOM point
where a line begins. Measurement always runs with spacers hidden through the
`document-pagination-measuring` class, so plans are computed from unpaginated
coordinates and every pass converges instead of compounding.

Two measurement rules are easy to get wrong and both produce visible gaps:

- Coordinates are measured against the frame that the page surfaces are
  positioned inside (`[data-document-export-root="true"]`), never against
  `.ProseMirror`. Any chrome between the two would otherwise shift every seam.
- Client rects are in zoom-scaled pixels while geometry is in CSS pixels, so
  every measurement is divided by the measured scale.

Because measurement is planned, applied, and then verified, a plan is never
trusted on its own. Every planned offset carries the absolute page coordinate it
targets, and `measureTiptapPageOffsetCorrections` re-reads where the content
after it actually rendered. Two rules make this safe:

- Corrections compare against the stored target, never against a page re-derived
  from where the content landed. Content that overshot into a page gap must be
  pushed forward to its target, not dragged back onto the page above it.
- Corrections are cumulative, planned by `planTiptapPageOffsetCorrections` in
  document order. Each offset's error moves everything below it, so a few pixels
  per seam compound into a large hole dozens of pages later; carrying the shift
  already applied above an offset corrects the whole document in one pass.

Corrections are bounded (three passes) and idempotent. The live extension also
fingerprints the unpaginated measurement, so the resize observer firing on its
own height change cannot replan back over a correction.

Only the renderers differ:

- The live editor uses `src/store/editor/pagination-extension.ts`. Spacers are
  ProseMirror widget decorations, never nodes, so pagination never reaches
  autosave, copy/paste, DOCX export, or read-only rules. Its transactions set
  `addToHistory: false` and do not change the document, so they must never mark
  a document dirty.
- Export clones use `src/lib/tiptap/tiptap-page-breaks.ts`, which inserts the
  same spacer elements directly because a clone is inert DOM. The html2canvas
  clone keeps the spacers it was given rather than measuring again inside the
  capture iframe.

Never insert pagination nodes into the live contenteditable surface from outside
TipTap, and never write measured page state into TipTap JSON.

## Line Splitting Rules

Paragraphs, headings, and blockquotes split at line boundaries. List blocks
paginate per list item, and tables paginate per row, so a long table continues on
the next page instead of moving or overlapping page chrome. Images and signature
blocks still move as one unit because they have no split point.

Table rows are offset differently from every other block: a spacer element
between rows is pulled out of the table by the HTML parser, so a row that starts
a new page is pushed by padding its cells (`document-page-row-offset`) instead.
The row box still begins at the seam, so the pushed row's top border is hidden
and its cell box crosses the inter-page gap. Splitting the table node itself
would be a document mutation and is not allowed here.

A block whose first line does not fit moves as a whole, so no line is ever left
inside footer chrome. Later lines receive spacers instead of moving the block,
which is what lets a paragraph span pages. A block is only flagged as overflow
when it genuinely cannot be paginated: a single line, image, or table taller
than one printable region.

The printable region keeps `PAPER_CONTENT_SAFETY_PX` of breathing room above the
footer and below the header, so a seam never leaves a line flush against page
chrome. The paged editor padding in `globals.css` adds the same value through
`--paper-content-safety`; the two must stay in sync or page one will start at a
different height than every page after it.

`pageBreakBefore` on a block that already opens a printable region applies no
push. Pushing it again would leave a page-sized hole above content that was
already in the right place.

The live editor may include a gray page gap in the page pitch so users can see
page boundaries clearly. Export and print capture must collapse that gap to
zero so generated PDF pages remain exact A4 slices. Oversized blocks that cannot
fit within one printable region should be flagged as render-only overflow
instead of being split or mutated by DOM code.

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

1. Open a long document in the live editor and inspect the first two page seams.
2. Confirm headings, paragraphs, lists, and page-break-before blocks start
   below the header chrome and stop above the footer chrome when they can fit
   within one printable region.
3. Confirm a paragraph longer than the remaining space continues at the top of
   the next page's printable region, with no line drawn across the seam, and
   that the overflow marker appears only for content taller than a whole page.
4. Toggle formatting marks and confirm page-break indicators do not change text
   flow or overlap the page header/footer.
5. Open print preview and confirm repeated page chrome matches the live editor
   without carrying the live gray page gap into exported page slices.
6. Check at least desktop and narrow laptop widths because ruler/outline
   presence changes the available canvas scroll area.

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
