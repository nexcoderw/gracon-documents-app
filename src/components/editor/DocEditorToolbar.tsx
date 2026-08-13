/**
 * DocEditorToolbar
 *
 * Google Docs-style formatting toolbar row. Sits below the menu bar as the
 * second row of the sticky editor header. Provides font, size, heading,
 * text-formatting, alignment, list, indent, and structural controls.
 *
 * All controls that have a direct Tiptap command are wired and fully functional.
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Editor } from '@tiptap/react';
import { SketchPicker, type ColorResult } from 'react-color';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    UndoIcon, RedoIcon, PrinterIcon,
    TextBoldIcon, TextItalicIcon, TextUnderlineIcon, TextStrikethroughIcon,
    TextAlignLeftIcon, TextAlignCenterIcon, TextAlignRightIcon, TextAlignJustifyLeftIcon,
    TextIndentMoreIcon, TextIndentLessIcon, HighlighterIcon, TextColorIcon,
    ParagraphBulletsPoint01Icon, ParagraphBulletsPointIcon,
    TableIcon, EraserIcon, CodeSquareIcon, QuoteUpIcon,
    RowInsertIcon, RowDeleteIcon, ColumnInsertIcon, ColumnDeleteIcon,
    TextFontIcon, HeadingIcon,
    ParagraphSpacingIcon,
} from '@hugeicons/core-free-icons';
import {
    BULLET_LIST_STYLE_OPTIONS,
    DEFAULT_BULLET_LIST_STYLE,
    DEFAULT_ORDERED_LIST_STYLE,
    FONT_SIZES,
    GOOGLE_FONTS,
    ORDERED_LIST_STYLE_OPTIONS,
    loadGoogleFont,
    normalizeBulletListStyle,
    normalizeOrderedListStyle,
    type BulletListStyle,
    type OrderedListStyle,
} from '@/constants';
import {
    setBulletListStyle,
    setOrderedListStyle,
    toggleBulletListStyle,
    toggleOrderedListStyle,
} from '@/store/editor/list-style-extension';
import {
    DEFAULT_TABLE_CELL_BACKGROUND,
    DEFAULT_TABLE_CELL_BORDER_COLOR,
    TABLE_BORDER_SIDES,
    tableBorderColorAttribute,
    tableBorderWidthAttribute,
    type TableBorderSide,
} from '@/store/editor/table-cell-style-extension';

const DEFAULT_LINE_HEIGHT = 1.8;
const LINE_HEIGHT_OPTIONS = [
    { label: 'Single', value: 1 },
    { label: '1.15', value: 1.15 },
    { label: '1.5', value: 1.5 },
    { label: 'Double', value: 2 },
] as const;
const MIN_CUSTOM_LINE_HEIGHT = 0.75;
const MAX_CUSTOM_LINE_HEIGHT = 3;
const TABLE_COLOR_PRESETS = [
    '#ffffff', '#f8fafc', '#f3f4f6', '#e5e7eb', '#fee2e2', '#ffedd5',
    '#fef3c7', '#dcfce7', '#dbeafe', '#ede9fe', '#111827', '#374151',
] as const;

// ─── Toolbar primitive ────────────────────────────────────────────────────────

function TbBtn({
    onClick, active = false, disabled = false, title, children,
}: {
    onClick: () => void; active?: boolean; disabled?: boolean;
    title: string; children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`ded-tb-btn${active ? ' ded-tb-btn--active' : ''}`}
        >
            {children}
        </button>
    );
}

function TbDivider() {
    return <div className="ded-tb-divider" />;
}

function preventToolbarFocus(event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
}

function useEditorRevision(editor: Editor) {
    const [, setRevision] = useState(0);

    useEffect(() => {
        const refresh = () => setRevision((value) => value + 1);
        editor.on('selectionUpdate', refresh);
        editor.on('transaction', refresh);
        editor.on('update', refresh);

        return () => {
            editor.off('selectionUpdate', refresh);
            editor.off('transaction', refresh);
            editor.off('update', refresh);
        };
    }, [editor]);
}

// ─── Text color picker ───────────────────────────────────────────────────────

const DEFAULT_TEXT_COLOR = '#000000';
const DEFAULT_HIGHLIGHT_COLOR = '#fff2cc';
const COLOR_PRESETS = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
    '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
    '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
    '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
    '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
] as const;

function normalizePickerColor(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function getEditorTextColor(editor: Editor) {
    return normalizePickerColor(editor.getAttributes('textStyle').color, DEFAULT_TEXT_COLOR);
}

function getEditorHighlightColor(editor: Editor) {
    return normalizePickerColor(editor.getAttributes('highlight').color, DEFAULT_HIGHLIGHT_COLOR);
}

function restoreToolbarSelection(editor: Editor, selection: { from: number; to: number } | null) {
    if (!selection) return editor.chain().focus();

    const maxPosition = editor.state.doc.content.size;
    return editor
        .chain()
        .focus()
        .setTextSelection({
            from: Math.min(selection.from, maxPosition),
            to: Math.min(selection.to, maxPosition),
        });
}

function TextColorPicker({ editor }: { editor: Editor }) {
    const [open, setOpen] = useState(false);
    const [currentColor, setCurrentColor] = useState(() => getEditorTextColor(editor));
    const ref = useRef<HTMLDivElement>(null);
    const selectionRef = useRef<{ from: number; to: number } | null>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        const syncColor = () => setCurrentColor(getEditorTextColor(editor));
        syncColor();
        editor.on('selectionUpdate', syncColor);
        editor.on('transaction', syncColor);
        return () => {
            editor.off('selectionUpdate', syncColor);
            editor.off('transaction', syncColor);
        };
    }, [editor]);

    function applyColor(color: ColorResult) {
        restoreToolbarSelection(editor, selectionRef.current).setColor(color.hex).run();
        setCurrentColor(color.hex);
    }

    function clearColor() {
        restoreToolbarSelection(editor, selectionRef.current).unsetColor().run();
        setCurrentColor(DEFAULT_TEXT_COLOR);
        setOpen(false);
    }

    function toggleOpen() {
        selectionRef.current = {
            from: editor.state.selection.from,
            to: editor.state.selection.to,
        };
        setOpen(v => !v);
    }

    return (
        <div ref={ref} className="ded-picker ded-color-picker">
            <button
                className={`ded-tb-btn ded-color-picker__trigger${open ? ' ded-tb-btn--active' : ''}`}
                onMouseDown={preventToolbarFocus}
                onClick={toggleOpen}
                title="Text color"
                aria-label="Text color"
                aria-expanded={open}
            >
                <HugeiconsIcon icon={TextColorIcon} size={15} />
                <span className="ded-color-picker__underline" style={{ backgroundColor: currentColor }} />
            </button>

            {open && (
                <div className="ded-picker__dropdown ded-picker__dropdown--left ded-color-picker__dropdown">
                    <div className="ded-color-picker__head">
                        <span>Text color</span>
                        <button type="button" onClick={clearColor}>Reset</button>
                    </div>
                    <SketchPicker
                        color={currentColor}
                        disableAlpha
                        presetColors={[...COLOR_PRESETS]}
                        width="252px"
                        onChange={applyColor}
                        onChangeComplete={applyColor}
                    />
                </div>
            )}
        </div>
    );
}

function HighlightColorPicker({ editor }: { editor: Editor }) {
    const [open, setOpen] = useState(false);
    const [currentColor, setCurrentColor] = useState(() => getEditorHighlightColor(editor));
    const ref = useRef<HTMLDivElement>(null);
    const selectionRef = useRef<{ from: number; to: number } | null>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        const syncColor = () => setCurrentColor(getEditorHighlightColor(editor));
        syncColor();
        editor.on('selectionUpdate', syncColor);
        editor.on('transaction', syncColor);
        return () => {
            editor.off('selectionUpdate', syncColor);
            editor.off('transaction', syncColor);
        };
    }, [editor]);

    function applyHighlight(color: ColorResult) {
        restoreToolbarSelection(editor, selectionRef.current).setHighlight({ color: color.hex }).run();
        setCurrentColor(color.hex);
    }

    function clearHighlight() {
        restoreToolbarSelection(editor, selectionRef.current).unsetHighlight().run();
        setCurrentColor(DEFAULT_HIGHLIGHT_COLOR);
        setOpen(false);
    }

    function toggleOpen() {
        selectionRef.current = {
            from: editor.state.selection.from,
            to: editor.state.selection.to,
        };
        setOpen(v => !v);
    }

    return (
        <div ref={ref} className="ded-picker ded-color-picker">
            <button
                className={`ded-tb-btn ded-color-picker__trigger${open || editor.isActive('highlight') ? ' ded-tb-btn--active' : ''}`}
                onMouseDown={preventToolbarFocus}
                onClick={toggleOpen}
                title="Highlight color"
                aria-label="Highlight color"
                aria-expanded={open}
            >
                <HugeiconsIcon icon={HighlighterIcon} size={15} />
                <span className="ded-color-picker__underline" style={{ backgroundColor: currentColor }} />
            </button>

            {open && (
                <div className="ded-picker__dropdown ded-picker__dropdown--left ded-color-picker__dropdown">
                    <div className="ded-color-picker__head">
                        <span>Highlight</span>
                        <button type="button" onClick={clearHighlight}>Reset</button>
                    </div>
                    <SketchPicker
                        color={currentColor}
                        disableAlpha
                        presetColors={[...COLOR_PRESETS]}
                        width="252px"
                        onChange={applyHighlight}
                        onChangeComplete={applyHighlight}
                    />
                </div>
            )}
        </div>
    );
}

// ─── Heading picker ───────────────────────────────────────────────────────────

const HEADING_LABELS = [
    { label: 'Paragraph',  value: 0 },
    { label: 'Heading 1',  value: 1 },
    { label: 'Heading 2',  value: 2 },
    { label: 'Heading 3',  value: 3 },
    { label: 'Heading 4',  value: 4 },
    { label: 'Heading 5',  value: 5 },
    { label: 'Heading 6',  value: 6 },
] as const;

function HeadingPicker({ editor }: { editor: Editor }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const active = HEADING_LABELS.find(h =>
        h.value === 0 ? editor.isActive('paragraph') : editor.isActive('heading', { level: h.value })
    ) ?? HEADING_LABELS[0];
    function applyHeading(value: typeof HEADING_LABELS[number]['value']) {
        if (value === 0) {
            editor.chain().focus().setParagraph().run();
        } else {
            editor.chain().focus().toggleHeading({ level: value }).run();
        }
        setOpen(false);
    }
    return (
        <div ref={ref} className="ded-picker" style={{ minWidth: 116 }}>
            <button className="ded-picker__btn" onClick={() => setOpen(v => !v)} title="Heading / paragraph style">
                <HugeiconsIcon icon={HeadingIcon} size={15} />
                <span>{active.label}</span>
                <span className="ded-picker__arrow">▾</span>
            </button>
            {open && (
                <div className="ded-picker__dropdown ded-picker__dropdown--left">
                    {HEADING_LABELS.map(h => (
                        <button key={h.value} className={`ded-picker__option${active.value === h.value ? ' ded-picker__option--active' : ''}`}
                            onClick={() => applyHeading(h.value)}>
                            {h.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Font family picker ───────────────────────────────────────────────────────

function FontPicker({ editor }: { editor: Editor }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const currentFont = (editor.getAttributes('textStyle').fontFamily as string | undefined) ?? 'Default';
    const filtered = GOOGLE_FONTS.filter(f => f.label.toLowerCase().includes(search.toLowerCase()));
    function applyFont(value: string) {
        loadGoogleFont(value);
        editor.chain().focus().setFontFamily(value).run();
        setOpen(false);
        setSearch('');
    }
    return (
        <div ref={ref} className="ded-picker" style={{ minWidth: 120 }}>
            <button className="ded-picker__btn" onClick={() => setOpen(v => !v)} title="Font family">
                <HugeiconsIcon icon={TextFontIcon} size={15} />
                <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentFont.split(',')[0]}
                </span>
                <span className="ded-picker__arrow">▾</span>
            </button>
            {open && (
                <div className="ded-picker__dropdown ded-picker__dropdown--left" style={{ width: 200 }}>
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>
                        <input className="ded-picker__search" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search fonts…" autoFocus />
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {filtered.map(f => (
                            <button key={f.value} className={`ded-picker__option${currentFont === f.value ? ' ded-picker__option--active' : ''}`}
                                style={{ fontFamily: `'${f.value}', sans-serif` }}
                                onClick={() => applyFont(f.value)}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Font size picker ─────────────────────────────────────────────────────────

function FontSizePicker({ editor }: { editor: Editor }) {
    const rawSize = (editor.getAttributes('textStyle').fontSize as string | undefined) ?? '';
    const currentPt = rawSize ? parseInt(rawSize, 10) : 11;
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function applySize(pt: number) {
        editor.chain().focus().setFontSize(`${Math.max(1, Math.min(400, pt))}pt`).run();
    }

    function selectSize(pt: number) {
        applySize(pt);
        setOpen(false);
    }

    return (
        <div ref={ref} className="ded-size-picker">
            <button
                className="ded-size-picker__step"
                type="button"
                onMouseDown={preventToolbarFocus}
                onClick={() => applySize(currentPt - 1)}
                title="Decrease font size"
            >
                −
            </button>
            <button
                className="ded-size-picker__value"
                type="button"
                onMouseDown={preventToolbarFocus}
                onClick={() => setOpen(value => !value)}
                title="Font size"
            >
                <span>{currentPt}</span>
                <span className="ded-size-picker__arrow">▾</span>
            </button>
            {open && (
                <div className="ded-picker__dropdown ded-picker__dropdown--left ded-size-picker__dropdown">
                    <div className="ded-picker__scroll">
                        {FONT_SIZES.map((size) => (
                            <button
                                key={size}
                                className={`ded-picker__option${currentPt === size ? ' ded-picker__option--active' : ''}`}
                                type="button"
                                onMouseDown={preventToolbarFocus}
                                onClick={() => selectSize(size)}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <button
                className="ded-size-picker__step"
                type="button"
                onMouseDown={preventToolbarFocus}
                onClick={() => applySize(currentPt + 1)}
                title="Increase font size"
            >
                +
            </button>
        </div>
    );
}

// ─── Line spacing picker ─────────────────────────────────────────────────────

function normalizeLineHeight(value: unknown) {
    const parsed = typeof value === 'number'
        ? value
        : typeof value === 'string'
            ? Number.parseFloat(value)
            : Number.NaN;

    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.min(MAX_CUSTOM_LINE_HEIGHT, Math.max(MIN_CUSTOM_LINE_HEIGHT, Number(parsed.toFixed(2))));
}

function formatLineHeight(value: number) {
    const preset = LINE_HEIGHT_OPTIONS.find(option => option.value === value);
    return preset ? preset.label : value.toFixed(2).replace(/\.?0+$/, '');
}

function readSelectedLineHeight(editor: Editor) {
    const values: (number | null)[] = [];
    const { state } = editor;

    state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
        if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
            return;
        }

        values.push(normalizeLineHeight(node.attrs.lineHeight));
    });

    if (values.length === 0) {
        const { $from } = state.selection;
        for (let depth = $from.depth; depth >= 0; depth -= 1) {
            const node = $from.node(depth);
            if (node.type.name === 'paragraph' || node.type.name === 'heading') {
                values.push(normalizeLineHeight(node.attrs.lineHeight));
                break;
            }
        }
    }

    const first = values[0] ?? null;
    return {
        value: first,
        mixed: values.some(value => value !== first),
    };
}

function LineHeightPicker({ editor }: { editor: Editor }) {
    const [open, setOpen] = useState(false);
    const [customValue, setCustomValue] = useState(String(DEFAULT_LINE_HEIGHT));
    const ref = useRef<HTMLDivElement>(null);
    const activeLineHeight = readSelectedLineHeight(editor);
    const currentValue = activeLineHeight.value ?? DEFAULT_LINE_HEIGHT;
    const currentLabel = activeLineHeight.mixed
        ? 'Mixed'
        : activeLineHeight.value === null
            ? 'Default'
            : formatLineHeight(currentValue);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (!open) {
            // Closing the picker deliberately resets its draft from editor state.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCustomValue(formatLineHeight(currentValue));
        }
    }, [currentValue, open]);

    function applyLineHeight(value: number | null) {
        editor.chain().focus().setParagraphLineHeight(value).run();
        setOpen(false);
    }

    function applyCustomLineHeight() {
        const parsed = normalizeLineHeight(customValue);
        if (parsed === null) return;
        applyLineHeight(parsed);
    }

    return (
        <div ref={ref} className="ded-line-height-picker">
            <button
                className={`ded-picker__btn ded-line-height-picker__btn${open ? ' ded-picker__btn--active' : ''}`}
                type="button"
                onMouseDown={preventToolbarFocus}
                onClick={() => setOpen(value => !value)}
                title="Line spacing"
                aria-label="Line spacing"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <HugeiconsIcon icon={ParagraphSpacingIcon} size={15} />
                <span className="ded-line-height-picker__value">{currentLabel}</span>
                <span className="ded-picker__arrow">▾</span>
            </button>
            {open && (
                <div className="ded-picker__dropdown ded-line-height-picker__dropdown" role="menu">
                    <div className="ded-line-height-picker__section">
                        {LINE_HEIGHT_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                className={`ded-picker__option ded-line-height-picker__option${!activeLineHeight.mixed && currentValue === option.value ? ' ded-picker__option--active' : ''}`}
                                type="button"
                                role="menuitemradio"
                                aria-checked={!activeLineHeight.mixed && currentValue === option.value}
                                onMouseDown={preventToolbarFocus}
                                onClick={() => applyLineHeight(option.value)}
                            >
                                <span>{option.label}</span>
                                <span className="ded-line-height-picker__sample" aria-hidden="true">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="ded-line-height-picker__custom">
                        <label htmlFor="ded-line-height-custom">Custom spacing</label>
                        <div className="ded-line-height-picker__custom-row">
                            <input
                                id="ded-line-height-custom"
                                value={customValue}
                                inputMode="decimal"
                                onChange={(event) => setCustomValue(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        applyCustomLineHeight();
                                    }
                                }}
                                onMouseDown={(event) => event.stopPropagation()}
                                aria-label="Custom line spacing"
                            />
                            <button
                                type="button"
                                onMouseDown={preventToolbarFocus}
                                onClick={applyCustomLineHeight}
                            >
                                Apply
                            </button>
                        </div>
                        <p>{MIN_CUSTOM_LINE_HEIGHT} to {MAX_CUSTOM_LINE_HEIGHT}</p>
                    </div>
                    <button
                        className="ded-line-height-picker__reset"
                        type="button"
                        onMouseDown={preventToolbarFocus}
                        onClick={() => applyLineHeight(null)}
                    >
                        Reset to document default
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── List style pickers ──────────────────────────────────────────────────────

function ListStylePicker({
    editor,
    kind,
}: {
    editor: Editor;
    kind: 'bulletList' | 'orderedList';
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const isBullet = kind === 'bulletList';
    const active = editor.isActive(kind);
    const options = isBullet ? BULLET_LIST_STYLE_OPTIONS : ORDERED_LIST_STYLE_OPTIONS;
    const currentStyle = isBullet
        ? normalizeBulletListStyle(editor.getAttributes('bulletList').listStyleType)
        : normalizeOrderedListStyle(editor.getAttributes('orderedList').listStyleType);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function toggleDefaultList() {
        if (isBullet) {
            toggleBulletListStyle(editor, DEFAULT_BULLET_LIST_STYLE);
        } else {
            toggleOrderedListStyle(editor, DEFAULT_ORDERED_LIST_STYLE);
        }
    }

    function selectStyle(style: BulletListStyle | OrderedListStyle) {
        if (isBullet) {
            setBulletListStyle(editor, style as BulletListStyle);
        } else {
            setOrderedListStyle(editor, style as OrderedListStyle);
        }

        setOpen(false);
    }

    return (
        <div ref={ref} className="ded-list-style-picker">
            <button
                className={`ded-list-style-picker__main${active ? ' ded-list-style-picker__main--active' : ''}`}
                type="button"
                aria-label={isBullet ? 'Toggle bullet list' : 'Toggle numbered list'}
                aria-pressed={active}
                onMouseDown={preventToolbarFocus}
                onClick={toggleDefaultList}
                title={isBullet ? 'Bullet list' : 'Numbered list'}
            >
                <HugeiconsIcon icon={isBullet ? ParagraphBulletsPoint01Icon : ParagraphBulletsPointIcon} size={15} />
            </button>
            <button
                className={`ded-list-style-picker__arrow${open ? ' ded-list-style-picker__arrow--open' : ''}`}
                type="button"
                aria-label={isBullet ? 'Choose bullet list style' : 'Choose numbered list style'}
                aria-haspopup="menu"
                aria-expanded={open}
                onMouseDown={preventToolbarFocus}
                onClick={() => setOpen(value => !value)}
                title={isBullet ? 'Bullet list styles' : 'Numbered list styles'}
            >
                ▾
            </button>
            {open && (
                <div className="ded-picker__dropdown ded-list-style-picker__dropdown" role="menu">
                    <div className="ded-picker__scroll">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                className={`ded-picker__option ded-list-style-picker__option${active && currentStyle === option.value ? ' ded-picker__option--active' : ''}`}
                                type="button"
                                role="menuitemradio"
                                aria-checked={active && currentStyle === option.value}
                                onMouseDown={preventToolbarFocus}
                                onClick={() => selectStyle(option.value)}
                            >
                                <span
                                    className="ded-list-style-picker__marker"
                                    style={{ listStyleType: option.value }}
                                    aria-hidden="true"
                                >
                                    {option.markerPreview}
                                </span>
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Table tools ─────────────────────────────────────────────────────────────

function getActiveTableCellAttributes(editor: Editor) {
    return editor.isActive('tableHeader')
        ? editor.getAttributes('tableHeader')
        : editor.getAttributes('tableCell');
}

function getActiveTableColor(editor: Editor, attribute: string, fallback: string) {
    const value = getActiveTableCellAttributes(editor)[attribute];
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function applyTableCellAttribute(editor: Editor, attribute: string, value: string | number) {
    editor.chain().focus().setCellAttribute(attribute, value).run();
}

function applyTableBorderSide(editor: Editor, side: TableBorderSide, color: string) {
    applyTableCellAttribute(editor, tableBorderColorAttribute(side), color);
    applyTableCellAttribute(editor, tableBorderWidthAttribute(side), 1);
}

function clearTableBorderSide(editor: Editor, side: TableBorderSide) {
    applyTableCellAttribute(editor, tableBorderWidthAttribute(side), 0);
}

function TableColorSwatches({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="ded-table-tools__swatches">
            {TABLE_COLOR_PRESETS.map((color) => (
                <button
                    key={color}
                    type="button"
                    className={`ded-table-tools__swatch${value === color ? ' ded-table-tools__swatch--active' : ''}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Use ${color}`}
                    onMouseDown={preventToolbarFocus}
                    onClick={() => onChange(color)}
                />
            ))}
            <label className="ded-table-tools__custom-color" title="Custom color">
                <input
                    type="color"
                    value={value.startsWith('#') ? value : DEFAULT_TABLE_CELL_BORDER_COLOR}
                    onChange={(event) => onChange(event.target.value)}
                />
                Custom
            </label>
        </div>
    );
}

function TableToolsPicker({ editor }: { editor: Editor }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const backgroundColor = getActiveTableColor(editor, 'backgroundColor', DEFAULT_TABLE_CELL_BACKGROUND);
    const borderColor = getActiveTableColor(editor, 'borderTopColor', DEFAULT_TABLE_CELL_BORDER_COLOR);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function applyAllBorders(color: string) {
        TABLE_BORDER_SIDES.forEach((side) => applyTableBorderSide(editor, side, color));
    }

    function clearAllBorders() {
        TABLE_BORDER_SIDES.forEach((side) => clearTableBorderSide(editor, side));
    }

    return (
        <div ref={ref} className="ded-table-tools">
            <button
                type="button"
                className={`ded-picker__btn ded-table-tools__trigger${open ? ' ded-picker__btn--active' : ''}`}
                onMouseDown={preventToolbarFocus}
                onClick={() => setOpen((value) => !value)}
                title="Table options"
                aria-label="Table options"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <HugeiconsIcon icon={TableIcon} size={15} />
                <span>Table</span>
                <span className="ded-picker__arrow">▾</span>
            </button>

            {open && (
                <div className="ded-picker__dropdown ded-table-tools__dropdown" role="menu">
                    <section className="ded-table-tools__section">
                        <p className="ded-table-tools__label">Rows and columns</p>
                        <div className="ded-table-tools__grid">
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => editor.chain().focus().addRowBefore().run()}>Row above</button>
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => editor.chain().focus().addRowAfter().run()}>Row below</button>
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => editor.chain().focus().addColumnBefore().run()}>Column left</button>
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => editor.chain().focus().addColumnAfter().run()}>Column right</button>
                        </div>
                    </section>

                    <section className="ded-table-tools__section">
                        <p className="ded-table-tools__label">Cell background</p>
                        <TableColorSwatches
                            value={backgroundColor}
                            onChange={(color) => applyTableCellAttribute(editor, 'backgroundColor', color)}
                        />
                    </section>

                    <section className="ded-table-tools__section">
                        <p className="ded-table-tools__label">Border color</p>
                        <TableColorSwatches
                            value={borderColor}
                            onChange={(color) => applyAllBorders(color)}
                        />
                        <div className="ded-table-tools__border-grid">
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => applyAllBorders(borderColor)}>All</button>
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => applyTableBorderSide(editor, 'top', borderColor)}>Top</button>
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => applyTableBorderSide(editor, 'right', borderColor)}>Right</button>
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => applyTableBorderSide(editor, 'bottom', borderColor)}>Bottom</button>
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => applyTableBorderSide(editor, 'left', borderColor)}>Left</button>
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={clearAllBorders}>No border</button>
                        </div>
                    </section>

                    <section className="ded-table-tools__section">
                        <p className="ded-table-tools__label">Structure</p>
                        <div className="ded-table-tools__grid">
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Header row</button>
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => editor.chain().focus().toggleHeaderColumn().run()}>Header column</button>
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => editor.chain().focus().mergeOrSplit().run()}>Merge / split</button>
                            <button type="button" onMouseDown={preventToolbarFocus} onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

// ─── Main toolbar ─────────────────────────────────────────────────────────────

/** Formatting toolbar — the second row of the sticky editor header. */
export function DocEditorToolbar({ editor }: { editor: Editor }) {
    useEditorRevision(editor);
    const inTable = editor.isActive('table');
    return (
        <div className="ded-toolbar">
            <TbBtn onClick={() => editor.chain().focus().undo().run()} title="Undo (⌘Z)" disabled={!editor.can().undo()}>
                <HugeiconsIcon icon={UndoIcon} size={15} />
            </TbBtn>
            <TbBtn onClick={() => editor.chain().focus().redo().run()} title="Redo (⌘⇧Z)" disabled={!editor.can().redo()}>
                <HugeiconsIcon icon={RedoIcon} size={15} />
            </TbBtn>
            <TbBtn onClick={() => window.print()} title="Print (⌘P)">
                <HugeiconsIcon icon={PrinterIcon} size={15} />
            </TbBtn>

            <TbDivider />
            <HeadingPicker editor={editor} />
            <TbDivider />
            <FontPicker editor={editor} />
            <FontSizePicker editor={editor} />

            <TbDivider />
            <TbBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (⌘B)">
                <HugeiconsIcon icon={TextBoldIcon} size={15} />
            </TbBtn>
            <TbBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (⌘I)">
                <HugeiconsIcon icon={TextItalicIcon} size={15} />
            </TbBtn>
            <TbBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (⌘U)">
                <HugeiconsIcon icon={TextUnderlineIcon} size={15} />
            </TbBtn>
            <TbBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
                <HugeiconsIcon icon={TextStrikethroughIcon} size={15} />
            </TbBtn>
            <HighlightColorPicker editor={editor} />
            <TextColorPicker editor={editor} />

            <TbDivider />
            <TbBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
                <HugeiconsIcon icon={TextAlignLeftIcon} size={15} />
            </TbBtn>
            <TbBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
                <HugeiconsIcon icon={TextAlignCenterIcon} size={15} />
            </TbBtn>
            <TbBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
                <HugeiconsIcon icon={TextAlignRightIcon} size={15} />
            </TbBtn>
            <TbBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
                <HugeiconsIcon icon={TextAlignJustifyLeftIcon} size={15} />
            </TbBtn>
            <LineHeightPicker editor={editor} />

            <TbDivider />
            <ListStylePicker editor={editor} kind="bulletList" />
            <ListStylePicker editor={editor} kind="orderedList" />
            <TbBtn onClick={() => editor.chain().focus().sinkListItem('listItem').run()} title="Increase indent" disabled={!editor.can().sinkListItem('listItem')}>
                <HugeiconsIcon icon={TextIndentMoreIcon} size={15} />
            </TbBtn>
            <TbBtn onClick={() => editor.chain().focus().liftListItem('listItem').run()} title="Decrease indent" disabled={!editor.can().liftListItem('listItem')}>
                <HugeiconsIcon icon={TextIndentLessIcon} size={15} />
            </TbBtn>

            <TbDivider />
            <TbBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
                <HugeiconsIcon icon={QuoteUpIcon} size={15} />
            </TbBtn>
            <TbBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
                <HugeiconsIcon icon={CodeSquareIcon} size={15} />
            </TbBtn>
            <TbBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table" disabled={inTable}>
                <HugeiconsIcon icon={TableIcon} size={15} />
            </TbBtn>
            {inTable && (
                <>
                    <TbDivider />
                    <TableToolsPicker editor={editor} />
                    <TbBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row below">
                        <HugeiconsIcon icon={RowInsertIcon} size={15} />
                    </TbBtn>
                    <TbBtn onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">
                        <HugeiconsIcon icon={RowDeleteIcon} size={15} />
                    </TbBtn>
                    <TbBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column after">
                        <HugeiconsIcon icon={ColumnInsertIcon} size={15} />
                    </TbBtn>
                    <TbBtn onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">
                        <HugeiconsIcon icon={ColumnDeleteIcon} size={15} />
                    </TbBtn>
                </>
            )}

            <TbDivider />
            <TbBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting">
                <HugeiconsIcon icon={EraserIcon} size={15} />
            </TbBtn>
        </div>
    );
}
