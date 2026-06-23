'use client';

/**
 * TipTap extension for persisted paragraph indentation attributes.
 *
 * The ruler needs stable paragraph layout data in the document schema so
 * selection-aware indent markers can be read consistently now and edited
 * directly in later steps without relying on fragile DOM inspection.
 */
import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { A4_PAPER_WIDTH_PX } from '@/constants';
import {
    DEFAULT_DOCUMENT_LAYOUT,
    normalizeParagraphTabStops,
    type ParagraphTabStop,
} from '@/lib/document-layout';
import {
    createParagraphExportGeometry,
    normalizeParagraphLineHeight,
} from '@/lib/document-layout-export-parity';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        paragraphLayout: {
            /**
             * Applies paragraph indentation attrs to selected paragraphs/headings.
             */
            setParagraphIndentation: (attrs: {
                leftIndent: number;
                firstLineIndent: number;
            }) => ReturnType;
            /**
             * Applies paragraph tab stops to selected paragraphs/headings.
             */
            setParagraphTabStops: (tabStops: ParagraphTabStop[]) => ReturnType;
            /**
             * Applies paragraph line height to selected paragraphs/headings.
             */
            setParagraphLineHeight: (lineHeight: number | null) => ReturnType;
            /**
             * Toggles whether selected paragraphs/headings start on a new page.
             */
            toggleParagraphPageBreakBefore: () => ReturnType;
        };
    }
}

function normalizeIndent(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

function normalizePageBreakBefore(value: unknown) {
    return value === true || value === 'true';
}

function parseIndentFromStyle(styleValue: string | null) {
    if (!styleValue) return 0;
    const parsed = Number.parseFloat(styleValue);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function parseLineHeightFromStyle(styleValue: string | null) {
    if (!styleValue || styleValue === 'normal') return null;

    if (styleValue.endsWith('%')) {
        return normalizeParagraphLineHeight(Number.parseFloat(styleValue) / 100);
    }

    return normalizeParagraphLineHeight(styleValue);
}

function normalizeTabStops(value: unknown) {
    return normalizeParagraphTabStops(
        A4_PAPER_WIDTH_PX,
        DEFAULT_DOCUMENT_LAYOUT.margins,
        value,
    );
}

function parseTabStops(value: string | null) {
    if (!value) return [];

    try {
        return normalizeTabStops(JSON.parse(value));
    } catch {
        return [];
    }
}

function sameTabStops(left: ParagraphTabStop[], right: ParagraphTabStop[]) {
    return left.length === right.length && left.every((value, index) => (
        value.position === right[index].position &&
        value.align === right[index].align
    ));
}

function setSelectedParagraphAttrs(
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined,
    buildAttrs: (attrs: Record<string, unknown>) => Record<string, unknown>,
    shouldSkip: (attrs: Record<string, unknown>) => boolean,
) {
    let tr = state.tr;
    let changed = false;
    let appliedCount = 0;

    state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
        if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
            return;
        }

        appliedCount += 1;

        if (shouldSkip(node.attrs)) {
            return;
        }

        tr = tr.setNodeMarkup(pos, undefined, buildAttrs(node.attrs));
        changed = true;
    });

    // Collapsed selections do not always surface through nodesBetween,
    // so fall back to the closest paragraph-like ancestor.
    if (appliedCount === 0) {
        const { $from } = state.selection;

        for (let depth = $from.depth; depth >= 0; depth -= 1) {
            const node = $from.node(depth);

            if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
                continue;
            }

            if (shouldSkip(node.attrs)) {
                break;
            }

            tr = tr.setNodeMarkup($from.before(depth), undefined, buildAttrs(node.attrs));
            changed = true;
            break;
        }
    }

    if (!changed) {
        return true;
    }

    if (dispatch) {
        dispatch(tr);
    }

    return true;
}

const DEFAULT_TAB_INTERVAL_PX = 48;
const ESTIMATED_CHARACTER_WIDTH_PX = 7.2;
const MIN_RENDERED_TAB_WIDTH_PX = 10;

function estimateTextWidth(text: string) {
    return text.length * ESTIMATED_CHARACTER_WIDTH_PX;
}

function estimateDecimalOffset(text: string) {
    const decimalIndex = text.search(/[.,]/);
    return estimateTextWidth(decimalIndex >= 0 ? text.slice(0, decimalIndex) : text);
}

function getFallbackTabStop(cursorPx: number): ParagraphTabStop {
    return {
        position: Math.ceil((cursorPx + 1) / DEFAULT_TAB_INTERVAL_PX) * DEFAULT_TAB_INTERVAL_PX,
        align: 'left',
    };
}

function resolveTabStop(tabStops: ParagraphTabStop[], cursorPx: number) {
    return tabStops.find((tabStop) => tabStop.position > cursorPx + 1) ?? getFallbackTabStop(cursorPx);
}

function getTextUntilNextTab(text: string, offset: number) {
    const nextTabIndex = text.indexOf('\t', offset + 1);
    return nextTabIndex === -1 ? text.slice(offset + 1) : text.slice(offset + 1, nextTabIndex);
}

function calculateRenderedTabWidth(tabStop: ParagraphTabStop, cursorPx: number, followingText: string) {
    let alignmentOffset = 0;

    if (tabStop.align === 'center') {
        alignmentOffset = estimateTextWidth(followingText) / 2;
    } else if (tabStop.align === 'right') {
        alignmentOffset = estimateTextWidth(followingText);
    } else if (tabStop.align === 'decimal') {
        alignmentOffset = estimateDecimalOffset(followingText);
    }

    return Math.max(
        MIN_RENDERED_TAB_WIDTH_PX,
        Math.round(tabStop.position - cursorPx - alignmentOffset),
    );
}

function collectBlockTextTabs(blockNode: ProseMirrorNode, blockPos: number) {
    const tabs: { pos: number; offset: number }[] = [];
    let textOffset = 0;

    blockNode.descendants((childNode, childPos) => {
        if (!childNode.isText) {
            return;
        }

        const text = childNode.text ?? '';

        for (let index = 0; index < text.length; index += 1) {
            if (text[index] === '\t') {
                tabs.push({
                    pos: blockPos + 1 + childPos + index,
                    offset: textOffset + index,
                });
            }
        }

        textOffset += text.length;
    });

    return tabs;
}

function buildTabStopDecorations(doc: ProseMirrorNode) {
    const decorations: Decoration[] = [];

    doc.descendants((node, pos) => {
        if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
            return;
        }

        const tabStops = normalizeTabStops(node.attrs.tabStops);
        const text = node.textContent;
        const tabs = collectBlockTextTabs(node, pos);
        let cursorPx = 0;
        let previousTextOffset = 0;

        tabs.forEach((tab) => {
            cursorPx += estimateTextWidth(text.slice(previousTextOffset, tab.offset));

            const tabStop = resolveTabStop(tabStops, cursorPx);
            const followingText = getTextUntilNextTab(text, tab.offset);
            const width = calculateRenderedTabWidth(tabStop, cursorPx, followingText);

            decorations.push(Decoration.inline(tab.pos, tab.pos + 1, {
                class: `document-tab-render document-tab-render--${tabStop.align}`,
                'data-tab-align': tabStop.align,
                style: `--document-tab-width: ${width}px;`,
            }));

            cursorPx = tabStop.position;
            previousTextOffset = tab.offset + 1;
        });
    });

    return DecorationSet.create(doc, decorations);
}

export const ParagraphLayoutExtension = Extension.create({
    name: 'paragraphLayout',

    addCommands() {
        return {
            setParagraphIndentation: (attrs) => ({ state, dispatch }) => {
                const nextLeftIndent = normalizeIndent(attrs.leftIndent);
                const nextFirstLineIndent = normalizeIndent(attrs.firstLineIndent);
                let tr = state.tr;
                let changed = false;
                let appliedCount = 0;

                state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
                    if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
                        return;
                    }

                    appliedCount += 1;

                    if (
                        normalizeIndent(node.attrs.leftIndent) === nextLeftIndent &&
                        normalizeIndent(node.attrs.firstLineIndent) === nextFirstLineIndent
                    ) {
                        return;
                    }

                    tr = tr.setNodeMarkup(pos, undefined, {
                        ...node.attrs,
                        leftIndent: nextLeftIndent,
                        firstLineIndent: nextFirstLineIndent,
                    });
                    changed = true;
                });

                // Collapsed selections do not always surface through nodesBetween,
                // so fall back to the closest paragraph-like ancestor.
                if (appliedCount === 0) {
                    const { $from } = state.selection;

                    for (let depth = $from.depth; depth >= 0; depth -= 1) {
                        const node = $from.node(depth);

                        if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
                            continue;
                        }

                        if (
                            normalizeIndent(node.attrs.leftIndent) === nextLeftIndent &&
                            normalizeIndent(node.attrs.firstLineIndent) === nextFirstLineIndent
                        ) {
                            break;
                        }

                        tr = tr.setNodeMarkup($from.before(depth), undefined, {
                            ...node.attrs,
                            leftIndent: nextLeftIndent,
                            firstLineIndent: nextFirstLineIndent,
                        });
                        changed = true;
                        break;
                    }
                }

                if (!changed) {
                    return true;
                }

                if (dispatch) {
                    dispatch(tr);
                }

                return true;
            },
            setParagraphTabStops: (tabStops) => ({ state, dispatch }) => {
                const nextTabStops = normalizeTabStops(tabStops);
                let tr = state.tr;
                let changed = false;
                let appliedCount = 0;

                state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
                    if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
                        return;
                    }

                    appliedCount += 1;

                    if (sameTabStops(normalizeTabStops(node.attrs.tabStops), nextTabStops)) {
                        return;
                    }

                    tr = tr.setNodeMarkup(pos, undefined, {
                        ...node.attrs,
                        tabStops: nextTabStops,
                    });
                    changed = true;
                });

                if (appliedCount === 0) {
                    const { $from } = state.selection;

                    for (let depth = $from.depth; depth >= 0; depth -= 1) {
                        const node = $from.node(depth);

                        if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
                            continue;
                        }

                        if (sameTabStops(normalizeTabStops(node.attrs.tabStops), nextTabStops)) {
                            break;
                        }

                        tr = tr.setNodeMarkup($from.before(depth), undefined, {
                            ...node.attrs,
                            tabStops: nextTabStops,
                        });
                        changed = true;
                        break;
                    }
                }

                if (!changed) {
                    return true;
                }

                if (dispatch) {
                    dispatch(tr);
                }

                return true;
            },
            setParagraphLineHeight: (lineHeight) => ({ state, dispatch }) => {
                const nextLineHeight = normalizeParagraphLineHeight(lineHeight);

                return setSelectedParagraphAttrs(
                    state,
                    dispatch,
                    (attrs) => ({
                        ...attrs,
                        lineHeight: nextLineHeight,
                    }),
                    (attrs) => normalizeParagraphLineHeight(attrs.lineHeight) === nextLineHeight,
                );
            },
            toggleParagraphPageBreakBefore: () => ({ state, dispatch }) => {
                let currentValue = false;
                let foundBlock = false;

                state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
                    if (foundBlock || (node.type.name !== 'paragraph' && node.type.name !== 'heading')) {
                        return;
                    }

                    currentValue = normalizePageBreakBefore(node.attrs.pageBreakBefore);
                    foundBlock = true;
                });

                if (!foundBlock) {
                    const { $from } = state.selection;

                    for (let depth = $from.depth; depth >= 0; depth -= 1) {
                        const node = $from.node(depth);

                        if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
                            continue;
                        }

                        currentValue = normalizePageBreakBefore(node.attrs.pageBreakBefore);
                        break;
                    }
                }

                const nextValue = !currentValue;

                return setSelectedParagraphAttrs(
                    state,
                    dispatch,
                    (attrs) => ({
                        ...attrs,
                        pageBreakBefore: nextValue,
                    }),
                    (attrs) => normalizePageBreakBefore(attrs.pageBreakBefore) === nextValue,
                );
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            Tab: () => this.editor.commands.insertContent('\t'),
            'Shift-Tab': () => false,
        };
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                props: {
                    decorations(state) {
                        return buildTabStopDecorations(state.doc);
                    },
                },
            }),
        ];
    },

    addGlobalAttributes() {
        return [
            {
                types: ['paragraph', 'heading'],
                attributes: {
                    leftIndent: {
                        default: 0,
                        parseHTML: (element) => {
                            const attr = element.getAttribute('data-left-indent');
                            if (attr) {
                                return normalizeIndent(Number.parseFloat(attr));
                            }

                            return parseIndentFromStyle(element.style.marginLeft);
                        },
                        renderHTML: (attributes) => {
                            const geometry = createParagraphExportGeometry({
                                leftIndent: attributes.leftIndent,
                                firstLineIndent: attributes.firstLineIndent,
                                lineHeight: attributes.lineHeight,
                                tabStops: attributes.tabStops,
                            });

                            if (!geometry.leftIndent && !geometry.firstLineIndent && geometry.lineHeight === null) {
                                return {};
                            }

                            return {
                                ...(geometry.dataAttributes.leftIndent ? { 'data-left-indent': geometry.dataAttributes.leftIndent } : {}),
                                style: geometry.cssStyle,
                            };
                        },
                    },
                    firstLineIndent: {
                        default: 0,
                        parseHTML: (element) => {
                            const attr = element.getAttribute('data-first-line-indent');
                            if (attr) {
                                return normalizeIndent(Number.parseFloat(attr));
                            }

                            return parseIndentFromStyle(element.style.textIndent);
                        },
                        renderHTML: (attributes) => {
                            const geometry = createParagraphExportGeometry({
                                leftIndent: attributes.leftIndent,
                                firstLineIndent: attributes.firstLineIndent,
                                tabStops: attributes.tabStops,
                            });

                            if (!geometry.firstLineIndent) {
                                return {};
                            }

                            return {
                                'data-first-line-indent': geometry.dataAttributes.firstLineIndent,
                            };
                        },
                    },
                    tabStops: {
                        default: [],
                        parseHTML: (element) => parseTabStops(element.getAttribute('data-tab-stops')),
                        renderHTML: (attributes) => {
                            const tabStops = normalizeTabStops(attributes.tabStops);

                            if (tabStops.length === 0) {
                                return {};
                            }

                            return { 'data-tab-stops': JSON.stringify(tabStops) };
                        },
                    },
                    lineHeight: {
                        default: null,
                        parseHTML: (element) => {
                            const attr = element.getAttribute('data-line-height');
                            if (attr) {
                                return normalizeParagraphLineHeight(attr);
                            }

                            return parseLineHeightFromStyle(element.style.lineHeight);
                        },
                        renderHTML: (attributes) => {
                            const lineHeight = normalizeParagraphLineHeight(attributes.lineHeight);

                            if (lineHeight === null) {
                                return {};
                            }

                            return { 'data-line-height': String(lineHeight) };
                        },
                    },
                    pageBreakBefore: {
                        default: false,
                        parseHTML: (element) => normalizePageBreakBefore(
                            element.getAttribute('data-page-break-before'),
                        ),
                        renderHTML: (attributes) => {
                            if (!normalizePageBreakBefore(attributes.pageBreakBefore)) {
                                return {};
                            }

                            return { 'data-page-break-before': 'true' };
                        },
                    },
                },
            },
        ];
    },
});
