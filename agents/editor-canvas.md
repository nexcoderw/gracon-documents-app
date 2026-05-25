# Editor Canvas Rules

Purpose: preserve the document editor, page geometry, ruler behavior, print preview, and export parity.

## TipTap Ownership

- TipTap owns rich text editing.
- The document app owns document chrome, page geometry, layout metadata, signing rails, preview, and export behavior.
- Do not mutate the editor DOM directly for content changes; route content edits through TipTap commands.

## Page Layout

- Persisted document layout metadata must stay compatible with editor rendering, ruler readouts, print preview, PDF export, and DOCX import/export.
- Page size, margins, paragraph indents, hanging indents, line spacing, and tab stops must use shared normalization helpers.
- Ruler changes should write into document/editor state and autosave paths, not sidecar UI-only state.

## Print Preview And Export

- The live editor must stay Gracon-owned; do not attach third-party pagination to editable editor surfaces.
- Print preview should use the stable Gracon-owned canvas/export path.
- Do not reintroduce runtime third-party pagination packages.
- Hidden preview/export renderers must clean up temporary DOM hosts, timers, refs, and callbacks after unmount.
- Print preview should not mount a hidden second editor just to prepare PDF export.

## Editor Images And Links

- Editor links must pass through safe URL normalization before entering TipTap content.
- Editor images must be stored as stable `api/documents` render URLs backed by private S3 objects.
- Image resizing should use TipTap node attributes so autosave and export preserve dimensions.

## Performance

- Autosave should skip unchanged TipTap JSON payloads.
- Long-document work must avoid unnecessary full editor remounts.
- Keep comments, activity, and signing side rails from shifting page geometry or ruler alignment.
