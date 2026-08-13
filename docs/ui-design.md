# UI And Design Rules

Purpose: keep the document workspace focused, accessible, responsive, and visually separate from printable document geometry.

## Visual Contract

- Documents, templates, local login, and protected loading surfaces retain the established soft off-white workspace.
- The editor workspace uses its neutral gray surround so white paper boundaries remain legible.
- Document paper, print preview paper, and export output remain white for fidelity.
- Application chrome uses existing CSS variables and shared tokens; do not hardcode hex values in components.
- Do not add background gradients.
- Use scoped `.glass`/`.glass-strong` surfaces only where the existing cross-app design system calls for glass chrome; never apply translucent glass to printable paper.
- Shared buttons, inputs, cards, and loaders own their styles in sibling CSS Modules; `globals.css` must not define their component presentation.
- Route and feature layout belongs in sibling CSS Modules, while inline styles are reserved for computed paper geometry and user-selected editor values.
- Use DM Sans through the existing font configuration.
- New motion must honor reduced-motion preferences.

## Information Hierarchy

- The document title, save/read-only status, primary workflow action, and canvas are visually primary.
- Formatting tools remain discoverable without competing with document content.
- Signing, comments, outline, and sharing are secondary rails/dialogs outside printable geometry.
- Signed, finalised, locked, conflict, offline, and access-revoked states must be unmistakable in text and behavior.
- Avoid helper copy for obvious controls; use labels/tooltips for unfamiliar or icon-only actions.

## Responsive Contract

Verify every changed surface at:

| Breakpoint |       Width | Expected behavior                                                                        |
| ---------- | ----------: | ---------------------------------------------------------------------------------------- |
| Mobile     |   320–767px | stacked controls, touch-safe actions, bounded canvas scrolling, near-full-screen dialogs |
| Tablet     |  768–1023px | compact toolbar/shell, collapsible rails, readable document access                       |
| Laptop     | 1024–1439px | stable rulers/canvas with constrained side rails                                         |
| Desktop    |     1440px+ | full workspace without stretching controls excessively                                   |

Rules:

- Build mobile-first with base, `sm:`, `md:`, `lg:`, and `xl:` ordering.
- No page-level horizontal scrolling. The editor canvas may use an intentional, bounded horizontal scroller when paper cannot fit.
- Forms stack below 480px.
- Dialogs are full-screen or near-full-screen on mobile, with close and primary actions kept visible.
- Touch targets are at least 44 by 44 pixels.
- Rendered text never drops below 13px.
- Use `clamp()` and adaptive grid patterns where they improve sizing without distorting paper units.
- Side rails collapse or overlay without changing canvas/page geometry.
- Test long titles, collaborator names, localized labels, large page counts, zoom, and browser text scaling.

## Editor Controls

- Toolbar buttons use semantic buttons, visible focus, accessible names, pressed/expanded state, and tooltips where needed.
- Disabled controls explain read-only, permission, selection, or unsupported-state reasons when not obvious.
- Popovers and menus support keyboard navigation, Escape, outside click, and focus restoration.
- Mixed multi-block formatting is explicit rather than showing a misleading single value.
- Pointer drag interactions need keyboard-accessible alternatives where practical and must support cancellation.
- Rulers, margins, tabs, and indent markers remain legible without relying on color alone.

## Loading And Recovery

- Use `DocumentLoadingState` for protected, document, editor, preview, and signing-progress loading.
- Provide context-specific `message` and `detail` text.
- Keep editor and print preview behind independent scoped recovery boundaries.
- A malformed image, table, extension, import node, or preview renderer must not crash the entire app.
- Preserve safe surrounding UI and offer retry/remount for the failed surface.
- Do not show an empty document when content is still loading or access is unresolved.

## Dialogs And High-Risk Actions

- Share, invitation, finalise, sign, lock, page setup, insert image/link, and export dialogs state their scope clearly.
- Destructive/permanent actions show the exact document/target and consequence.
- Disable duplicate submission and show structured pending state.
- Distinguish failure from uncertain outcome; do not show success until confirmed.
- Focus the dialog heading or first meaningful control, trap focus, restore focus on close, and use Escape only when cancellation is safe.
- Timed or multi-step workflows must remain understandable to screen-reader and keyboard users.

## Paper, Rulers, And Rails

- Paper dimensions and printable margins are visualized from normalized layout data.
- UI chrome never changes export dimensions.
- Gray page gaps are live-editor aids and disappear from export capture.
- Repeated header/footer/page-number chrome must align between editor and preview.
- The signing progress rail stays fixed to the visible body/canvas region and does not scroll with document content.
- Outline and comments panels do not obscure critical canvas controls at narrow widths.

## Documents, Templates, And Lists

- Lists have bounded pagination or an explicitly bounded loading strategy.
- Empty states explain the next useful action.
- Cards use scoped modules; do not reintroduce global `doc-card` styles.
- Destructive document actions require confirmation.
- Search/filter loading must not turn prior results into a misleading empty state.
- Template previews and document thumbnails must not expose private raw asset URLs.

## Feedback And Accessibility

- Use the shared toast system for transient success/error feedback; durable workflow failures also need in-page context.
- Maintain semantic landmarks and heading order.
- Preserve visible focus and sufficient contrast.
- Announce save state, read-only transitions, import/export completion, and critical failures without noisy continuous live regions.
- Use text alongside color for status.
- Respect reduced motion for loading visuals, menu transitions, page navigation, and count effects.
- Verify keyboard-only navigation, screen-reader names, 200% zoom, and mobile touch use.

## UI Checklist

- Paper and chrome have separate styling/geometry responsibilities.
- Loading, empty, denied, read-only, conflict, offline, failure, and uncertain states are explicit.
- Editor controls expose correct keyboard and accessibility state.
- Layout works at 320px, 768px, 1024px, and 1440px.
- Canvas scrolling is intentional and bounded.
- No new global feature CSS, gradients, hardcoded colors, or geometry-shifting rails were introduced.
