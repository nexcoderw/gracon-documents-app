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
9. Keep section breaks, mixed orientation, and per-section margins as a later
   architecture change.

## Measurement Rules

Page metrics are derived from the rendered `.ProseMirror` element with
`src/lib/tiptap/tiptap-page-metrics.ts`. Measurement may drive UI such as a page
status chip, left-page ruler labels, and an outline rail. Measurement must not
write to document JSON.

Page geometry is normalized by `src/lib/tiptap/tiptap-page-geometry.ts`.
The live editor and export clones use temporary CSS variables from
`src/lib/tiptap/tiptap-page-breaks.ts` to move whole rendered blocks away from
header/footer chrome when they would cross an automatic page seam. These
offsets are render-only and must not be written into TipTap JSON.

The measured page count is advisory in the live editor. Manual page breaks and
automatic block offsets improve visual parity, but long paragraphs that need
line-level splitting remain a later pagination step.

The live editor may include a gray page gap in the page pitch so users can see
page boundaries clearly. Export and print capture must collapse that gap to
zero so generated PDF pages remain exact A4 slices. Oversized blocks that cannot
fit within one printable region should be flagged as render-only overflow
instead of being split or mutated by DOM code.

## Future Page-Break Rules

Manual page breaks are represented in the editor schema, not as unmanaged DOM
nodes. The first supported feature is `pageBreakBefore` on paragraphs and
headings because it can be preserved through autosave, import, export, and
read-only rendering.

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
