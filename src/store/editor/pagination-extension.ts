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
    measureTiptapPageOffsetCorrections,
    PAGE_MEASURING_CLASS,
    PAGE_ROW_KEY_ATTRIBUTE,
    PAGE_ROW_OFFSET_CLASS,
    PAGE_ROW_OFFSET_VAR,
    type TiptapMeasuredPageBlock,
} from '@/lib/tiptap/tiptap-page-layout-dom';
import { planTiptapPageLayout } from '@/lib/tiptap/tiptap-page-layout-plan';
import {
    createTiptapLivePageGeometry,
    type TiptapPageGeometry,
    type TiptapPageGeometryInput,
} from '@/lib/tiptap/tiptap-page-geometry';

const PAGE_OVERFLOW_ATTR = 'data-document-page-overflow';

/** Debounce for re-paginating after content edits. */
const CONTENT_SETTLE_MS = 90;

/** Correction attempts allowed before a layout is accepted as-is. */
const MAX_CORRECTION_PASSES = 3;

export const paginationPluginKey = new PluginKey<PaginationPluginState>('documentPagination');

/** One measured offset waiting to be rendered as a decoration. */
interface PaginationSpacerSpec {
    pos: number;
    height: number;
    /**
     * `row` offsets pad a table row's cells, because a spacer element between
     * table rows would be pulled out of the table by the HTML parser.
     */
    kind: 'block' | 'line' | 'row';
    /** Document coordinate this offset is meant to place its content at. */
    targetTop: number;
    /** End position of the row node, for row decorations. */
    endPos?: number;
}

interface PaginationPluginState {
    decorations: DecorationSet;
    signature: string;
    /** The specs the current decorations were built from. */
    specs: PaginationSpacerSpec[];
    /**
     * Fingerprint of the unpaginated measurement these specs came from. Applying
     * spacers changes the editor's height, which fires the resize observer; this
     * lets a repeat pass recognize unchanged content and keep the corrected
     * heights instead of replanning back to the uncorrected ones.
     */
    sourceSignature: string;
}

interface PaginationMeta {
    specs: PaginationSpacerSpec[];
    signature: string;
    sourceSignature: string;
}

/** One measurement pass: the spacers to render and what produced them. */
interface PaginationMeasurement {
    specs: PaginationSpacerSpec[];
    sourceSignature: string;
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

function createSpecKey(spec: PaginationSpacerSpec) {
    return `${spec.kind}-${spec.pos}`;
}

/**
 * Renders one planned offset as a decoration.
 *
 * @param spec - The offset to render.
 * @returns A row decoration for table rows, or a spacer widget otherwise.
 */
function createSpecDecoration(spec: PaginationSpacerSpec) {
    const key = createSpecKey(spec);

    if (spec.kind === 'row' && spec.endPos !== undefined) {
        return Decoration.node(spec.pos, spec.endPos, {
            class: PAGE_ROW_OFFSET_CLASS,
            style: `${PAGE_ROW_OFFSET_VAR}: ${spec.height}px`,
            [PAGE_ROW_KEY_ATTRIBUTE]: key,
        });
    }

    return Decoration.widget(
        spec.pos,
        (view) => createTiptapPageSpacerElement(view.dom.ownerDocument, spec.height, key),
        {
            key,
            side: -1,
            ignoreSelection: true,
            marks: [],
        },
    );
}

function createSignature(specs: PaginationSpacerSpec[]) {
    return specs.map((spec) => `${createSpecKey(spec)}:${spec.height}`).join('|');
}

/**
 * Fingerprints the unpaginated measurement a plan was built from.
 *
 * @param geometry - Page geometry used for the plan.
 * @param blocks - Blocks measured with spacers hidden.
 * @returns A string that changes only when content, width, or geometry changes.
 */
function createSourceSignature(
    geometry: TiptapPageGeometry,
    blocks: TiptapMeasuredPageBlock[],
) {
    const pageKey = [
        geometry.pageHeight,
        geometry.pagePitch,
        geometry.printableTop,
        geometry.printableBottom,
    ].join('/');
    const blockKey = blocks
        .map((block) => [
            Math.round(block.top),
            Math.round(block.height),
            block.lines.length,
            block.forceNextPage === true ? 1 : 0,
        ].join('/'))
        .join('|');

    return `${pageKey}#${blockKey}`;
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
): PaginationMeasurement {
    const root = view.dom as HTMLElement;
    const pageGeometry = createTiptapLivePageGeometry(geometry);
    const specs: PaginationSpacerSpec[] = [];
    const overflow = new Map<HTMLElement, boolean>();
    let sourceSignature = '';

    root.classList.add(PAGE_MEASURING_CLASS);

    try {
        const blocks = measureTiptapPageBlocks(root);
        const plans = planTiptapPageLayout(pageGeometry, blocks);

        sourceSignature = createSourceSignature(pageGeometry, blocks);

        blocks.forEach((block, index) => {
            const plan = plans[index];

            // The overflow marker changes block heights in formatting-marks
            // mode, so it is applied only after every position is resolved.
            overflow.set(block.element, plan.overflow);

            if (plan.offset > 0) {
                const pos = getBlockPosition(view, block.element);
                const node = pos === null ? null : view.state.doc.nodeAt(pos);

                if (pos !== null && block.offsetMode === 'row-padding' && node) {
                    specs.push({
                        pos,
                        endPos: pos + node.nodeSize,
                        height: plan.offset,
                        kind: 'row',
                        targetTop: plan.targetTop,
                    });
                } else if (pos !== null) {
                    specs.push({
                        pos,
                        height: plan.offset,
                        kind: 'block',
                        targetTop: plan.targetTop,
                    });
                }
            }

            plan.spacers.forEach((spacer) => {
                const line = block.lines[spacer.lineIndex];
                if (!line) {
                    return;
                }

                const pos = getLinePosition(view, root, block.element, line.top);
                if (pos !== null) {
                    specs.push({
                        pos,
                        height: spacer.height,
                        kind: 'line',
                        targetTop: spacer.targetTop,
                    });
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

    return { specs, sourceSignature };
}

/**
 * Runs one pagination pass and commits it only when the layout actually changed.
 *
 * @param view - Active editor view.
 * @param geometry - Page geometry input for the current document layout.
 */
function runPaginationPass(view: EditorView, geometry: TiptapPageGeometryInput) {
    if (!view.dom.isConnected) {
        return false;
    }

    const state = paginationPluginKey.getState(view.state);
    const measurement = measureSpacers(view, geometry);

    // Unchanged content keeps whatever corrections it already received.
    if (state && measurement.sourceSignature === state.sourceSignature) {
        return false;
    }

    return commitSpecs(view, measurement.specs, measurement.sourceSignature);
}

/**
 * Corrects spacers whose rendered result missed the page grid.
 *
 * The planner works from measurements, so fractional line heights and anonymous
 * block boxes can leave content a few pixels — occasionally much more — away
 * from where a page should start. This pass reads the rendered result and
 * rewrites those heights, which is what stops visible gaps at a page seam.
 *
 * @param view - Active editor view.
 * @returns True when a correction was committed.
 */
function runCorrectionPass(view: EditorView) {
    if (!view.dom.isConnected) {
        return false;
    }

    const state = paginationPluginKey.getState(view.state);
    if (!state || state.specs.length === 0) {
        return false;
    }

    const corrections = measureTiptapPageOffsetCorrections(
        view.dom as HTMLElement,
        state.specs.map((spec) => ({
            key: createSpecKey(spec),
            targetTop: spec.targetTop,
            height: spec.height,
        })),
    );

    if (corrections.length === 0) {
        return false;
    }

    const correctedHeights = new Map(
        corrections.map((correction) => [correction.key, correction.correctedHeight] as const),
    );

    const corrected = state.specs.map((spec) => {
        const height = correctedHeights.get(createSpecKey(spec));

        return height === undefined ? spec : { ...spec, height };
    });

    return commitSpecs(view, corrected, state.sourceSignature);
}

/**
 * Publishes spacer specs when they differ from what is already rendered.
 *
 * @param view - Active editor view.
 * @param specs - Spacer specs to render.
 * @param sourceSignature - Fingerprint of the measurement behind these specs.
 * @returns True when a transaction was dispatched.
 */
function commitSpecs(
    view: EditorView,
    specs: PaginationSpacerSpec[],
    sourceSignature: string,
) {
    const signature = createSignature(specs);
    const state = paginationPluginKey.getState(view.state);

    if (signature === state?.signature && sourceSignature === state?.sourceSignature) {
        return false;
    }

    const meta: PaginationMeta = { specs, signature, sourceSignature };
    view.dispatch(view.state.tr.setMeta(paginationPluginKey, meta).setMeta('addToHistory', false));

    return true;
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
                    init: () => ({
                        decorations: DecorationSet.empty,
                        signature: '',
                        specs: [],
                        sourceSignature: '',
                    }),
                    apply: (tr, value, _oldState, newState) => {
                        const meta = tr.getMeta(paginationPluginKey) as PaginationMeta | undefined;

                        if (meta) {
                            return {
                                decorations: DecorationSet.create(
                                    newState.doc,
                                    meta.specs.map(createSpecDecoration),
                                ),
                                signature: meta.signature,
                                specs: meta.specs,
                                sourceSignature: meta.sourceSignature,
                            };
                        }

                        if (!tr.docChanged) {
                            return value;
                        }

                        // Keep spacers anchored to their content until the next pass.
                        return {
                            decorations: value.decorations.map(tr.mapping, tr.doc),
                            signature: value.signature,
                            specs: value.specs,
                            // Edited content must be measured again from scratch.
                            sourceSignature: '',
                        };
                    },
                },

                props: {
                    decorations: (state) => paginationPluginKey.getState(state)?.decorations,
                },

                view: (view) => {
                    let frame: number | null = null;
                    let correctionFrame: number | null = null;
                    let timer: ReturnType<typeof setTimeout> | null = null;

                    const cancel = () => {
                        if (frame !== null) window.cancelAnimationFrame(frame);
                        if (correctionFrame !== null) window.cancelAnimationFrame(correctionFrame);
                        if (timer !== null) clearTimeout(timer);
                        frame = null;
                        correctionFrame = null;
                        timer = null;
                    };

                    // Corrections run after the browser has laid out the spacers
                    // that were just committed, and stop as soon as they agree.
                    const scheduleCorrection = (pass: number) => {
                        if (pass >= MAX_CORRECTION_PASSES) {
                            return;
                        }

                        correctionFrame = window.requestAnimationFrame(() => {
                            correctionFrame = null;

                            if (runCorrectionPass(view)) {
                                scheduleCorrection(pass + 1);
                            }
                        });
                    };

                    const schedule = (delay = 0) => {
                        cancel();
                        timer = setTimeout(() => {
                            frame = window.requestAnimationFrame(() => {
                                frame = null;

                                if (runPaginationPass(view, storage.geometry)) {
                                    scheduleCorrection(0);
                                }
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
