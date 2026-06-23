/**
 * use-editor-actions
 *
 * Custom hook that encapsulates all document-editor menu action state and
 * handling: file import, save-as, copy, print, and all editor commands
 * (edit, format, insert). Extracted from DocEditorHeader to keep the header
 * component focused on layout and wiring.
 */
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Editor } from '@tiptap/react';
import {
    createDocument, autosaveDocument, copyDocument,
    type DocumentDetail,
} from '@/api/documents.api';
import { toast } from '@/components/ui';
import { INSERT_ACTION_IDS } from '@/constants/insert-menu';
import type { InsertImageDialogValues } from '@/components/editor/InsertImageDialog';
import type { InsertLinkDialogValues } from '@/components/editor/InsertLinkDialog';
import { importDocumentToTiptap } from '@/lib/import-document';
import { saveRenderedDocumentAs } from '@/lib/export-document';
import { normalizeEditorImageUrl } from '@/lib/editor-image';
import { normalizeEditorLinkUrl } from '@/lib/editor-link';
import { createTableOfContentsNodes } from '@/lib/tiptap/tiptap-table-of-contents';
import {
    buildSignatureBlockInserts,
    type SignatureBlockSigner,
} from '@/lib/editor-signature-blocks';

const INSERT_SPECIAL_CHARACTER_MAP: Partial<Record<string, string>> = {
    [INSERT_ACTION_IDS.emDash]: '—',
    [INSERT_ACTION_IDS.enDash]: '–',
    [INSERT_ACTION_IDS.nonBreakingSpace]: '\u00A0',
    [INSERT_ACTION_IDS.copyright]: '©',
    [INSERT_ACTION_IDS.trademark]: '™',
    [INSERT_ACTION_IDS.registered]: '®',
    [INSERT_ACTION_IDS.checkmark]: '✓',
};

function createDateTimeInsert(actionId: string) {
    const now = new Date();
    const date = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(now);
    const time = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    }).format(now);

    if (actionId === INSERT_ACTION_IDS.currentDate) return date;
    if (actionId === INSERT_ACTION_IDS.currentTime) return time;
    if (actionId === INSERT_ACTION_IDS.dateTime) return `${date} at ${time}`;
    return null;
}

function promptForFootnoteNote() {
    return window.prompt('Footnote text');
}

interface UseEditorActionsOptions {
    editor: Editor | null;
    doc: DocumentDetail;
    editingTitle: boolean;
    title: string;
    isReadOnly: boolean;
    canPrepareSignatureBlocks?: boolean;
    signatureBlockSigners?: SignatureBlockSigner[];
    onPrepareSignatureBlocks?: () => void;
    onTitleEditStart: () => void;
    onTitleSave: () => void | Promise<void>;
    /** Called when the Edit → Find menu item is dispatched. */
    onFindToggle: () => void;
    /** Called when a View menu action is dispatched. */
    onViewAction?: (actionId: string) => void;
    /** Called when Insert → Comment should open the review composer. */
    onCreateComment?: () => void;
}

interface UseEditorActionsReturn {
    importing: boolean;
    copying: boolean;
    savingAs: 'pdf' | 'docx' | null;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    linkDialog: {
        open: boolean;
        mode: 'create' | 'edit';
        text: string;
        url: string;
        error: string | null;
        canRemove: boolean;
    };
    imageDialog: { open: boolean };
    /** Pass to the hidden <input type="file"> onChange handler. */
    handleFileImport: (file: File) => Promise<void>;
    /** Dispatches a menu action ID to the appropriate handler or editor command. */
    handleAction: (actionId: string) => void;
    closeLinkDialog: () => void;
    submitLinkDialog: (values: InsertLinkDialogValues) => void;
    removeLink: () => void;
    closeImageDialog: () => void;
    submitImageDialog: (values: InsertImageDialogValues) => void;
}

/**
 * Encapsulates all editor menu action handling and the async state it drives.
 *
 * @param options - Editor instance, document details, and callback hooks.
 * @returns Action state flags, the hidden file input ref, and the action dispatcher.
 */
export function useEditorActions({
    editor, doc, editingTitle, title, isReadOnly,
    canPrepareSignatureBlocks = false,
    signatureBlockSigners = [],
    onTitleEditStart, onTitleSave, onFindToggle, onViewAction,
    onCreateComment,
    onPrepareSignatureBlocks,
}: UseEditorActionsOptions): UseEditorActionsReturn {
    const router = useRouter();
    const [importing, setImporting] = useState(false);
    const [copying,   setCopying]   = useState(false);
    const [savingAs,  setSavingAs]  = useState<'pdf' | 'docx' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const linkSelectionRef = useRef<{ from: number; to: number } | null>(null);
    const [linkDialog, setLinkDialog] = useState({
        open: false,
        mode: 'create' as 'create' | 'edit',
        text: '',
        url: '',
        error: null as string | null,
        canRemove: false,
    });
    const [imageDialog, setImageDialog] = useState({ open: false });

    /** Converts an uploaded document to TipTap JSON, then saves it as a new document. */
    const handleFileImport = useCallback(async (file: File) => {
        setImporting(true);
        const toastId = toast.loading('Importing document…');
        try {
            const { content, title: suggestedTitle } = await importDocumentToTiptap(file);
            const imported = await createDocument({ type: 'RICH_TEXT', title: suggestedTitle });
            await autosaveDocument(imported.id, content);
            toast.dismiss(toastId);
            toast.success(`"${suggestedTitle}" imported`);
            router.push('/documents');
        } catch (err: unknown) {
            toast.dismiss(toastId);
            toast.error(err instanceof Error ? err.message : 'Failed to import document.');
        } finally {
            setImporting(false);
            // Reset so the same file can be re-selected if needed.
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [router]);

    const closeLinkDialog = useCallback(() => {
        setLinkDialog((current) => ({ ...current, open: false, error: null }));
        linkSelectionRef.current = null;
    }, []);

    const openLinkDialog = useCallback(() => {
        if (!editor) return;
        if (isReadOnly) {
            toast.warning('This document is read-only.');
            return;
        }

        const { from, to, empty } = editor.state.selection;
        const href = editor.getAttributes('link').href;
        const url = typeof href === 'string' ? href : '';
        const selectedText = empty ? '' : editor.state.doc.textBetween(from, to, ' ');

        linkSelectionRef.current = { from, to };
        setLinkDialog({
            open: true,
            mode: url ? 'edit' : 'create',
            text: selectedText,
            url,
            error: null,
            canRemove: Boolean(url),
        });
    }, [editor, isReadOnly]);

    const submitLinkDialog = useCallback((values: InsertLinkDialogValues) => {
        if (!editor || isReadOnly) return;

        const normalized = normalizeEditorLinkUrl(values.url);
        if (!normalized.ok) {
            setLinkDialog((current) => ({ ...current, error: normalized.error }));
            return;
        }

        const selection = linkSelectionRef.current ?? {
            from: editor.state.selection.from,
            to: editor.state.selection.to,
        };
        const displayText = values.text.trim() || normalized.url;
        const selectedText = selection.from === selection.to
            ? ''
            : editor.state.doc.textBetween(selection.from, selection.to, ' ');

        if (selection.from === selection.to && linkDialog.mode === 'edit') {
            editor
                .chain()
                .focus()
                .setTextSelection(selection)
                .extendMarkRange('link')
                .setLink({ href: normalized.url })
                .run();
        } else if (selection.from !== selection.to && (!values.text.trim() || displayText === selectedText)) {
            editor
                .chain()
                .focus()
                .setTextSelection(selection)
                .setLink({ href: normalized.url })
                .run();
        } else {
            editor
                .chain()
                .focus()
                .setTextSelection(selection)
                .insertContent({
                    type: 'text',
                    text: displayText,
                    marks: [{
                        type: 'link',
                        attrs: {
                            href: normalized.url,
                            target: '_blank',
                            rel: 'noopener noreferrer nofollow',
                        },
                    }],
                })
                .run();
        }

        closeLinkDialog();
    }, [closeLinkDialog, editor, isReadOnly, linkDialog.mode]);

    const removeLink = useCallback(() => {
        if (!editor || isReadOnly) return;
        const selection = linkSelectionRef.current ?? {
            from: editor.state.selection.from,
            to: editor.state.selection.to,
        };

        editor
            .chain()
            .focus()
            .setTextSelection(selection)
            .extendMarkRange('link')
            .unsetLink()
            .run();
        closeLinkDialog();
    }, [closeLinkDialog, editor, isReadOnly]);

    const closeImageDialog = useCallback(() => {
        setImageDialog({ open: false });
    }, []);

    const openImageDialog = useCallback(() => {
        if (!editor) return;
        if (isReadOnly) {
            toast.warning('This document is read-only.');
            return;
        }
        setImageDialog({ open: true });
    }, [editor, isReadOnly]);

    const submitImageDialog = useCallback((values: InsertImageDialogValues) => {
        if (!editor || isReadOnly) return;

        const normalized = normalizeEditorImageUrl(values.src);
        if (!normalized.ok) {
            toast.error(normalized.error);
            return;
        }

        editor
            .chain()
            .focus()
            .insertContent({
                type: 'image',
                attrs: {
                    src: normalized.url,
                    alt: values.alt,
                    title: values.title,
                    containerStyle: 'width: 420px; height: auto; cursor: pointer; margin: 14px auto;',
                    wrapperStyle: 'display: flex; margin: 0;',
                },
            })
            .run();
        closeImageDialog();
    }, [closeImageDialog, editor, isReadOnly]);

    const handleAction = useCallback((actionId: string) => {
        if (actionId.startsWith('view:')) {
            if (editingTitle) {
                void Promise.resolve(onTitleSave());
            }
            onViewAction?.(actionId);
            return;
        }

        // ── File: New ──────────────────────────────────────────────────────────
        if (actionId === 'file:new') {
            // Open a placeholder tab synchronously so popup blockers do not fire.
            const loadingUrl = new URL('/documents', window.location.origin).toString();
            const newTab = window.open(loadingUrl, '_blank');
            createDocument({ type: 'RICH_TEXT' })
                .then((created) => {
                    if (newTab) {
                        newTab.location.replace(
                            new URL(`/documents/${created.id}/edit`, window.location.origin).toString(),
                        );
                    } else {
                        toast.error('Popup blocked. Please allow popups and try again.');
                    }
                })
                .catch(() => { newTab?.close(); toast.error('Failed to create document.'); });
            return;
        }

        // ── File: Open ─────────────────────────────────────────────────────────
        if (actionId === 'file:open') {
            if (!importing) fileInputRef.current?.click();
            return;
        }

        // ── File: Rename ───────────────────────────────────────────────────────
        if (actionId === 'file:rename') {
            if (isReadOnly) { toast.warning('This document cannot be renamed right now.'); return; }
            onTitleEditStart();
            return;
        }

        // ── File: Make a copy ──────────────────────────────────────────────────
        if (actionId === 'file:copy') {
            if (copying) return;
            setCopying(true);
            Promise.resolve()
                .then(async () => {
                    if (editingTitle) await Promise.resolve(onTitleSave());
                    if (doc.status === 'DRAFT' && editor) {
                        const content = editor.getJSON() as Record<string, unknown>;
                        const words =
                            (editor.storage.characterCount?.words?.() as number | undefined)
                            ?? doc.wordCount;
                        await autosaveDocument(doc.id, content, words);
                    }
                    const copied = await copyDocument(doc.id);
                    toast.success(`Created "${copied.title}"`);
                    router.push(`/documents/${copied.id}/edit`);
                })
                .catch((error: unknown) => {
                    const msg = (error as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message;
                    toast.error(typeof msg === 'string' && msg.trim() ? msg : 'Failed to make a copy.');
                })
                .finally(() => setCopying(false));
            return;
        }

        // ── File: Save as PDF / DOCX ───────────────────────────────────────────
        if (actionId === 'file:save-as-pdf' || actionId === 'file:save-as-docx') {
            if (savingAs) return;
            const format = actionId === 'file:save-as-pdf' ? 'pdf' : 'docx';
            setSavingAs(format);
            Promise.resolve()
                .then(async () => {
                    if (editingTitle) await Promise.resolve(onTitleSave());
                    const exportRoot = document.querySelector('[data-document-export-root="true"]') as HTMLElement | null;
                    if (!exportRoot) throw new Error('Could not find the rendered document to export.');
                    await saveRenderedDocumentAs(format, title.trim() || doc.title, exportRoot);
                    toast.success(`Saved as ${format.toUpperCase()}`);
                })
                .catch((error: unknown) => {
                    toast.error(
                        error instanceof Error
                            ? error.message
                            : `Failed to save as ${format.toUpperCase()}.`,
                    );
                })
                .finally(() => setSavingAs(null));
            return;
        }

        if (actionId === 'file:print') {
            onViewAction?.('view:print-preview');
            return;
        }

        // ── Edit: Find ─────────────────────────────────────────────────────────
        if (actionId === 'edit:find') {
            onFindToggle();
            return;
        }

        if (!editor) return;

        if (actionId === INSERT_ACTION_IDS.image) {
            openImageDialog();
            return;
        }

        if (actionId === INSERT_ACTION_IDS.link) {
            openLinkDialog();
            return;
        }

        if (actionId === INSERT_ACTION_IDS.headerFooter) {
            onViewAction?.('view:page-setup');
            return;
        }

        if (actionId === INSERT_ACTION_IDS.comment) {
            onCreateComment?.();
            return;
        }

        if (actionId === INSERT_ACTION_IDS.tableOfContents) {
            if (isReadOnly) {
                toast.warning('This document is read-only.');
                return;
            }

            editor.commands.insertContent(createTableOfContentsNodes(editor.getJSON() as Record<string, unknown>));
            return;
        }

        if (actionId === INSERT_ACTION_IDS.footnote) {
            if (isReadOnly) {
                toast.warning('This document is read-only.');
                return;
            }

            const note = promptForFootnoteNote();
            if (note === null) return;

            const inserted = editor.commands.insertFootnoteReference({ note });
            if (!inserted) {
                toast.warning('Enter footnote text before inserting.');
            }
            return;
        }

        if (actionId === INSERT_ACTION_IDS.pageBreakBefore) {
            if (isReadOnly) {
                toast.warning('This document is read-only.');
                return;
            }

            editor.commands.toggleParagraphPageBreakBefore();
            return;
        }

        if (actionId === INSERT_ACTION_IDS.signatureBlocks) {
            if (!canPrepareSignatureBlocks) {
                toast.warning('Only the document owner can prepare signature blocks.');
                return;
            }

            if (onPrepareSignatureBlocks) {
                onPrepareSignatureBlocks();
                return;
            }

            const blocks = buildSignatureBlockInserts(
                signatureBlockSigners,
                doc.completedSignatures,
                doc.signatureSnapshot,
            );

            if (blocks.length === 0) {
                toast.warning('Invite at least one signer before preparing signature blocks.');
                return;
            }

            const inserted = editor.commands.syncAssignedSignatureBlocks(blocks);
            if (inserted) {
                toast.success(`Prepared ${blocks.length} assigned signature block${blocks.length === 1 ? '' : 's'}.`);
            }
            return;
        }

        const dateTimeInsert = createDateTimeInsert(actionId);
        if (dateTimeInsert) {
            editor.chain().focus().insertContent(dateTimeInsert).run();
            return;
        }

        const specialCharacter = INSERT_SPECIAL_CHARACTER_MAP[actionId];
        if (specialCharacter) {
            editor.chain().focus().insertContent(specialCharacter).run();
            return;
        }

        // ── All editor commands ────────────────────────────────────────────────
        const chain = editor.chain().focus();
        switch (actionId) {
            case 'edit:undo':        chain.undo().run(); break;
            case 'edit:redo':        chain.redo().run(); break;
            case 'edit:cut':         editor.view.focus(); document.execCommand('cut'); break;
            case 'edit:copy':        editor.view.focus(); document.execCommand('copy'); break;
            case 'edit:paste':
                navigator.clipboard.readText()
                    .then((text) => { if (text) editor.chain().focus().insertContent(text).run(); })
                    .catch(() => toast.warning('Paste using ⌘V / Ctrl+V'));
                break;
            case 'edit:select-all':  chain.selectAll().run(); break;
            case 'format:bold':      chain.toggleBold().run(); break;
            case 'format:italic':    chain.toggleItalic().run(); break;
            case 'format:underline': chain.toggleUnderline().run(); break;
            case 'format:strike':    chain.toggleStrike().run(); break;
            case 'format:highlight': chain.toggleHighlight().run(); break;
            case 'format:clear':     chain.clearNodes().unsetAllMarks().run(); break;
            case INSERT_ACTION_IDS.table:
                chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                break;
            case INSERT_ACTION_IDS.horizontalRule:
                chain.setHorizontalRule().run();
                break;
        }
    }, [
        copying, doc.completedSignatures, doc.id, doc.signatureSnapshot, doc.status, doc.title, doc.wordCount,
        editingTitle, editor, importing, isReadOnly,
        canPrepareSignatureBlocks, onPrepareSignatureBlocks, openImageDialog, openLinkDialog,
        onCreateComment, onFindToggle, onTitleEditStart, onTitleSave, onViewAction,
        router, savingAs, signatureBlockSigners, title,
    ]);

    return {
        importing,
        copying,
        savingAs,
        fileInputRef,
        linkDialog,
        imageDialog,
        handleFileImport,
        handleAction,
        closeLinkDialog,
        submitLinkDialog,
        removeLink,
        closeImageDialog,
        submitImageDialog,
    };
}
