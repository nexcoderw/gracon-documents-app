'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, FontFamily, FontSize, BackgroundColor } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DocumentPaperSheet } from '@/components/documents/DocumentPaperSheet';
import { normalizeEditorLinkUrl } from '@/lib/editor-link';
import { removeDocumentBoundariesFromTiptapContent } from '@/lib/remove-document-boundaries';
import {
    CommentAnchorExtension,
    type CommentAnchorInput,
} from '@/store/editor/comment-anchor-extension';
import {
    ListStyleExtension,
    toggleBulletListStyle,
    toggleOrderedListStyle,
} from '@/store/editor/list-style-extension';
import { ParagraphLayoutExtension } from '@/store/editor/paragraph-layout-extension';
import { SignatureBlockExtension } from '@/store/editor/signature-block-extension';
import { ImportedDocxStyleExtension } from '@/store/editor/imported-docx-style-extension';
import { ResizableImageExtension } from '@/store/editor/resizable-image-extension';
import { FootnoteReferenceExtension } from '@/store/editor/footnote-reference-extension';
import { StyledTableCell, StyledTableHeader } from '@/store/editor/table-cell-style-extension';

const SecureClickableLinkExtension = Extension.create({
    name: 'secureClickableLink',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('secureClickableLink'),
                props: {
                    handleClick: (_view, _pos, event) => {
                        if (event.button !== 0) {
                            return false;
                        }

                        const target = event.target;
                        if (!(target instanceof Element)) {
                            return false;
                        }

                        const link = target.closest<HTMLAnchorElement>('a[href]');
                        if (!link || !this.editor.view.dom.contains(link)) {
                            return false;
                        }

                        const normalized = normalizeEditorLinkUrl(link.getAttribute('href') ?? '');
                        if (!normalized.ok) {
                            return false;
                        }

                        this.editor.commands.extendMarkRange('link');
                        const openedWindow = window.open(
                            normalized.url,
                            '_blank',
                            'noopener,noreferrer',
                        );
                        if (openedWindow) {
                            openedWindow.opener = null;
                        }

                        return true;
                    },
                },
            }),
        ];
    },
});

interface RichTextEditorProps {
    initialContent?: Record<string, unknown> | null;
    onContentChange?: (content: Record<string, unknown>, wordCount: number) => void;
    /** Called once when the Tiptap editor instance is ready. Use to lift editor up to the page. */
    onEditorReady?: (editor: Editor) => void;
    /** When true, suppresses the built-in EditorToolbar (external toolbar takes over). */
    hideToolbar?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    paperMode?: boolean;
    paperTitle?: string;
    paperStatus?: string;
    pageNumber?: number;
    pageCount?: number;
    paperStyle?: CSSProperties;
    /**
     * Rendered as an absolutely-positioned overlay that fills the paper sheet.
     * Used for the draggable signature block so it can be placed anywhere on
     * the page rather than being constrained to the document flow.
     */
    overlayContent?: ReactNode;
    commentAnchors?: CommentAnchorInput[];
}

export function RichTextEditor({
    initialContent,
    onContentChange,
    onEditorReady,
    hideToolbar = false,
    readOnly = false,
    placeholder = 'Start writing your document…',
    paperMode = false,
    paperTitle = 'Document',
    paperStatus,
    pageNumber = 1,
    pageCount = 1,
    paperStyle,
    overlayContent,
    commentAnchors = [],
}: RichTextEditorProps) {
    const onChangeRef = useRef(onContentChange);
    const onEditorReadyRef = useRef(onEditorReady);
    const appliedInitialContentRef = useRef<Record<string, unknown> | null>(null);
    const sanitizedInitialContent = useMemo(
        () => removeDocumentBoundariesFromTiptapContent(initialContent)
            ?? { type: 'doc', content: [{ type: 'paragraph' }] },
        [initialContent],
    );

    useEffect(() => {
        onChangeRef.current = onContentChange;
    }, [onContentChange]);

    useEffect(() => {
        onEditorReadyRef.current = onEditorReady;
    }, [onEditorReady]);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4, 5, 6] },
                codeBlock: { languageClassPrefix: 'language-' },
                link: false,
                dropcursor: {
                    color: '#5b35f5',
                    width: 2,
                },
            }),
            TextStyle,
            Color,
            BackgroundColor,
            FontFamily,
            FontSize,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Table.configure({ resizable: true }),
            TableRow,
            StyledTableHeader,
            StyledTableCell,
            Highlight.configure({ multicolor: true }),
            ResizableImageExtension.configure({
                allowBase64: false,
                inline: false,
                minWidth: 96,
                maxWidth: 720,
                HTMLAttributes: {
                    loading: 'lazy',
                    decoding: 'async',
                },
            }),
            Link.configure({
                openOnClick: false,
                autolink: false,
                linkOnPaste: false,
                isAllowedUri: (url) => normalizeEditorLinkUrl(url ?? '').ok,
                HTMLAttributes: {
                    target: '_blank',
                    rel: 'noopener noreferrer nofollow',
                },
            }),
            SecureClickableLinkExtension,
            Placeholder.configure({ placeholder }),
            CharacterCount,
            CommentAnchorExtension,
            ListStyleExtension,
            ParagraphLayoutExtension,
            ImportedDocxStyleExtension,
            FootnoteReferenceExtension,
            SignatureBlockExtension,
        ],
        content: sanitizedInitialContent,
        editable: !readOnly,
        onUpdate: ({ editor: e }) => {
            const json = e.getJSON();
            const wordCount = e.storage.characterCount.words() as number;
            onChangeRef.current?.(json as Record<string, unknown>, wordCount);
        },
        onCreate: ({ editor: e }) => {
            onEditorReadyRef.current?.(e);
        },
    });

    useEffect(() => {
        if (!editor || !sanitizedInitialContent || readOnly) return;
        if (appliedInitialContentRef.current === sanitizedInitialContent) return;
        if (editor.isFocused) return;

        appliedInitialContentRef.current = sanitizedInitialContent;
        editor.commands.setContent(sanitizedInitialContent, { emitUpdate: false });
    }, [editor, sanitizedInitialContent, readOnly]);

    useEffect(() => {
        if (!editor) return;
        editor.setEditable(!readOnly, false);
    }, [editor, readOnly]);

    useEffect(() => {
        if (!editor) return;
        editor.commands.setCommentAnchors(commentAnchors);
    }, [editor, commentAnchors]);

    if (!editor) return null;

    if (paperMode) {
        const footerLabel = paperStatus
            ? `${paperStatus.toLowerCase()} document`
            : readOnly
                ? 'Read-only document'
                : 'Editable draft';
        const paperEditorClassName = overlayContent
            ? 'tiptap-editor tiptap-editor-paper tiptap-editor-paper-signed'
            : 'tiptap-editor tiptap-editor-paper';
        const pageLabel = pageCount > 1
            ? `Page ${pageNumber} of ${pageCount}`
            : `Page ${pageNumber}`;

        return (
            <div className={paperEditorClassName} style={paperStyle}>
                {!readOnly && !hideToolbar && <EditorToolbar editor={editor} paperMode />}
                <DocumentPaperSheet
                    className="document-paper-sheet--editor"
                    bodyClassName="document-paper-sheet__body--editor"
                    eyebrow={readOnly ? 'Locked page' : ''}
                    title={paperTitle}
                    meta={<span className="document-paper-sheet__page-tag">{pageLabel}</span>}
                    footer={(
                        <div className="document-paper-sheet__footer-bar">
                            <span>{footerLabel}</span>
                            <span>{pageLabel}</span>
                        </div>
                    )}
                    overlay={overlayContent}
                >
                    <EditorContent editor={editor} />
                </DocumentPaperSheet>
            </div>
        );
    }

    return (
        <div className="tiptap-editor">
            {!readOnly && !hideToolbar && <EditorToolbar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function ToolbarButton({
    onClick, active, disabled, title, children,
}: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            style={{
                width: 30, height: 30,
                borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${active ? 'var(--color-border-primary)' : 'transparent'}`,
                background: active ? 'var(--color-primary-subtle)' : 'transparent',
                color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 100ms ease',
            }}
            onMouseEnter={e => { if (!active && !disabled) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(91,35,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'; } }}
            onMouseLeave={e => { if (!active && !disabled) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)'; } }}
        >
            {children}
        </button>
    );
}

function Divider() {
    return <div style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px', flexShrink: 0 }} />;
}

function EditorToolbar({
    editor,
    paperMode = false,
}: {
    editor: Editor;
    paperMode?: boolean;
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            width: paperMode ? 'fit-content' : 'auto',
            margin: paperMode ? '0 auto 14px' : 0,
            padding: paperMode ? '10px 14px' : '8px 12px',
            border: paperMode ? '1px solid rgba(91,35,255,0.14)' : 'none',
            borderBottom: paperMode ? '1px solid rgba(91,35,255,0.14)' : '1px solid var(--editor-toolbar-border)',
            background: paperMode ? 'rgba(255,255,255,0.88)' : 'var(--editor-toolbar-bg)',
            boxShadow: paperMode ? '0 16px 34px rgba(22,16,58,0.08)' : 'none',
            backdropFilter: 'blur(18px)',
            borderRadius: paperMode ? '999px' : 'var(--radius-lg) var(--radius-lg) 0 0',
            position: 'sticky',
            top: paperMode ? 16 : 0,
            zIndex: 10,
        }}>
            {/* History */}
            <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>↩</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>↪</ToolbarButton>

            <Divider />

            {/* Headings */}
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">H1</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolbarButton>

            <Divider />

            {/* Inline formatting */}
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><strong>B</strong></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><u>U</u></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><s>S</s></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">🖊</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">{`</>`}</ToolbarButton>

            <Divider />

            {/* Alignment */}
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">⬅</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Center">↔</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">➡</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">☰</ToolbarButton>

            <Divider />

            {/* Lists */}
            <ToolbarButton onClick={() => toggleBulletListStyle(editor)} active={editor.isActive('bulletList')} title="Bullet list">• —</ToolbarButton>
            <ToolbarButton onClick={() => toggleOrderedListStyle(editor)} active={editor.isActive('orderedList')} title="Numbered list">1.</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">❝</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">{'{}'}</ToolbarButton>

            <Divider />

            {/* Table */}
            <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">⊞</ToolbarButton>
            {editor.isActive('table') && (
                <>
                    <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column">+col</ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row">+row</ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">✕⊞</ToolbarButton>
                </>
            )}

            <Divider />

            {/* Horizontal rule */}
            <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">—</ToolbarButton>
        </div>
    );
}
