/**
 * Live page layout for the editable document surface.
 *
 * The editor is one continuous ProseMirror surface drawn over stacked page
 * backgrounds. This extension measures the rendered document and inserts
 * decoration-only spacers so content starts below each page header, stops above
 * each footer, and long paragraphs continue on the next page at a line boundary
 * instead of running through page chrome.
 *
 * Spacers are decorations, never document nodes: nothing here reaches autosave,
 * copy/paste, DOCX export, or the read-only rules in `document-readonly.ts`.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import {
    createTiptapPageSpacerElement,
    findTiptapLineStartPoint,
    measureTiptapPageBlocks,
    PAGE_MEASURING_CLASS,
} from '@/lib/tiptap/tiptap-page-layout-dom';
import { planTiptapPageLayout } from '@/lib/tiptap/tiptap-page-layout-plan';
import {
    createTiptapLivePageGeometry,
    type TiptapPageGeometryInput,
} from '@/lib/tiptap/tiptap-page-geometry';

const PAGE_OVERFLOW_ATTR = 'data-document-page-overflow';

/** Debounce for re-paginating after content edits. */
const CONTENT_SETTLE_MS = 90;

export const paginationPluginKey = new PluginKey<PaginationPluginState>('documentPagination');

/** One measured spacer waiting to be rendered as a decoration. */
interface PaginationSpacerSpec {
    pos: number;
    height: number;
    kind: 'block' | 'line';
}

interface PaginationPluginState {
    decorations: DecorationSet;
    signature: string;
}

interface PaginationMeta {
    specs: PaginationSpacerSpec[];
    signature: string;
}

/** Editor-scoped pagination state shared between React and the plugin. */
interface PaginationStorage {
    /** Page geometry for the current document layout. */
    geometry: TiptapPageGeometryInput;
    /** Requests another pagination pass; null while the view is not mounted. */
    schedule: (() => void) | null;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        documentPagination: {
            /** Re-measures page layout, optionally with new page geometry. */
            refreshDocumentPagination: (geometry?: TiptapPageGeometryInput) => ReturnType;
        };
    }

    interface Storage {
        documentPagination: PaginationStorage;
    }
}

function createSignature(specs: PaginationSpacerSpec[]) {
    return specs.map((spec) => `${spec.kind}:${spec.pos}:${spec.height}`).join('|');
}

/**
 * Resolves the document position immediately before a rendered block element.
 *
 * @param view - Active editor view.
 * @param element - Rendered block element.
 * @returns The block's start position, or null when it cannot be resolved.
 */
function getBlockPosition(view: EditorView, element: HTMLElement): number | null {
    try {
        return Math.max(0, view.posAtDOM(element, 0) - 1);
    } catch {
        // Elements rendered outside the document model have no position.
        return null;
    }
}

/**
 * Resolves the document position where a rendered line begins.
 *
 * @param view - Active editor view.
 * @param root - Rendered editor root used as the coordinate origin.
 * @param element - Block element that owns the line.
 * @param lineTop - Line top relative to the root.
 * @returns The line's start position, or null when it cannot be resolved.
 */
function getLinePosition(
    view: EditorView,
    root: HTMLElement,
    element: HTMLElement,
    lineTop: number,
): number | null {
    const point = findTiptapLineStartPoint(root, element, lineTop);
    if (!point) {
        return null;
    }

    try {
        return view.posAtDOM(point.node, point.offset);
    } catch {
        return null;
    }
}

/**
 * Measures the document and returns the spacers it needs.
 *
 * Spacers are hidden while measuring so every coordinate describes unpaginated
 * content; positions are resolved in that same window for the same reason.
 *
 * @param view - Active editor view.
 * @param geometry - Page geometry input for the current document layout.
 * @returns Spacer specs in document order.
 */
function measureSpacers(
    view: EditorView,
    geometry: TiptapPageGeometryInput,
): PaginationSpacerSpec[] {
    const root = view.dom as HTMLElement;
    const pageGeometry = createTiptapLivePageGeometry(geometry);
    const specs: PaginationSpacerSpec[] = [];
    const overflow = new Map<HTMLElement, boolean>();

    root.classList.add(PAGE_MEASURING_CLASS);

    try {
        const blocks = measureTiptapPageBlocks(root);
        const plans = planTiptapPageLayout(pageGeometry, blocks);

        blocks.forEach((block, index) => {
            const plan = plans[index];

            // The overflow marker changes block heights in formatting-marks
            // mode, so it is applied only after every position is resolved.
            overflow.set(block.element, plan.overflow);

            if (plan.offset > 0) {
                const pos = getBlockPosition(view, block.element);
                if (pos !== null) {
                    specs.push({ pos, height: plan.offset, kind: 'block' });
                }
            }

            plan.spacers.forEach((spacer) => {
                const line = block.lines[spacer.lineIndex];
                if (!line) {
                    return;
                }

                const pos = getLinePosition(view, root, block.element, line.top);
                if (pos !== null) {
                    specs.push({ pos, height: spacer.height, kind: 'line' });
                }
            });
        });
    } finally {
        root.classList.remove(PAGE_MEASURING_CLASS);
    }

    overflow.forEach((isOverflowing, element) => {
        if (isOverflowing) {
            element.setAttribute(PAGE_OVERFLOW_ATTR, 'true');
            return;
        }

        element.removeAttribute(PAGE_OVERFLOW_ATTR);
    });

    return specs;
}

/**
 * Runs one pagination pass and commits it only when the layout actually changed.
 *
 * @param view - Active editor view.
 * @param geometry - Page geometry input for the current document layout.
 */
function runPaginationPass(view: EditorView, geometry: TiptapPageGeometryInput) {
    if (!view.dom.isConnected) {
        return;
    }

    const specs = measureSpacers(view, geometry);
    const signature = createSignature(specs);

    if (signature === paginationPluginKey.getState(view.state)?.signature) {
        return;
    }

    const meta: PaginationMeta = { specs, signature };
    view.dispatch(view.state.tr.setMeta(paginationPluginKey, meta).setMeta('addToHistory', false));
}

/**
 * Creates the live pagination extension for the document editor.
 *
 * @returns A TipTap extension that keeps rendered content inside page bounds.
 */
export const PaginationExtension = Extension.create({
    name: 'documentPagination',

    addCommands() {
        return {
            refreshDocumentPagination: (geometry) => ({ editor }) => {
                editor.storage.documentPagination.geometry =
                    geometry ?? editor.storage.documentPagination.geometry;
                editor.storage.documentPagination.schedule?.();

                return true;
            },
        };
    },

    addStorage(): PaginationStorage {
        return {
            geometry: {},
            schedule: null,
        };
    },

    addProseMirrorPlugins() {
        const storage = this.storage;

        return [
            new Plugin<PaginationPluginState>({
                key: paginationPluginKey,

                state: {
                    init: () => ({ decorations: DecorationSet.empty, signature: '' }),
                    apply: (tr, value, _oldState, newState) => {
                        const meta = tr.getMeta(paginationPluginKey) as PaginationMeta | undefined;

                        if (meta) {
                            return {
                                decorations: DecorationSet.create(
                                    newState.doc,
                                    meta.specs.map((spec) => Decoration.widget(
                                        spec.pos,
                                        (view) => createTiptapPageSpacerElement(
                                            view.dom.ownerDocument,
                                            spec.height,
                                        ),
                                        {
                                            key: `${spec.kind}-${spec.pos}-${spec.height}`,
                                            side: -1,
                                            ignoreSelection: true,
                                            marks: [],
                                        },
                                    )),
                                ),
                                signature: meta.signature,
                            };
                        }

                        if (!tr.docChanged) {
                            return value;
                        }

                        // Keep spacers anchored to their content until the next pass.
                        return {
                            decorations: value.decorations.map(tr.mapping, tr.doc),
                            signature: value.signature,
                        };
                    },
                },

                props: {
                    decorations: (state) => paginationPluginKey.getState(state)?.decorations,
                },

                view: (view) => {
                    let frame: number | null = null;
                    let timer: ReturnType<typeof setTimeout> | null = null;

                    const cancel = () => {
                        if (frame !== null) window.cancelAnimationFrame(frame);
                        if (timer !== null) clearTimeout(timer);
                        frame = null;
                        timer = null;
                    };

                    const schedule = (delay = 0) => {
                        cancel();
                        timer = setTimeout(() => {
                            frame = window.requestAnimationFrame(() => {
                                runPaginationPass(view, storage.geometry);
                            });
                        }, delay);
                    };

                    storage.schedule = () => schedule();

                    const resizeObserver = new ResizeObserver(() => schedule());
                    const handleWindowResize = () => schedule();

                    resizeObserver.observe(view.dom);
                    window.addEventListener('resize', handleWindowResize);
                    // Web fonts change every line box, so re-run once they land.
                    void view.dom.ownerDocument.fonts?.ready.then(() => schedule());
                    schedule();

                    return {
                        update: (_updatedView, previousState) => {
                            if (!previousState.doc.eq(view.state.doc)) {
                                schedule(CONTENT_SETTLE_MS);
                            }
                        },
                        destroy: () => {
                            cancel();
                            storage.schedule = null;
                            resizeObserver.disconnect();
                            window.removeEventListener('resize', handleWindowResize);
                        },
                    };
                },
            }),
        ];
    },
});
