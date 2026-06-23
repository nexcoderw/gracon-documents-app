/**
 * DocEditorHeader
 *
 * Google Docs-style two-row sticky editor header.
 * Row 1 (menu bar): logo/back, document title, menu strip (File … Help), right actions.
 * Row 2 (toolbar):  formatting toolbar via DocEditorToolbar.
 * Row 3 (find bar): inline find bar, shown when Edit → Find is active.
 *
 * All action handling is delegated to useEditorActions.
 * Menu rendering is handled by MenuDropdown.
 * Find-in-document is handled by EditorFindBar.
 */
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { Editor } from '@tiptap/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowLeft01Icon, StarIcon, FolderOpenIcon,
    Share01Icon, Comment01Icon, Clock01Icon,
} from '@hugeicons/core-free-icons';
import type { MenuItem } from '@/constants';
import type { DocumentDetail } from '@/api/documents.api';
import type { SignatureBlockSigner } from '@/lib/editor-signature-blocks';
import { INSERT_ACTION_IDS, MENU_BAR } from '@/constants';
import { DocEditorToolbar } from './DocEditorToolbar';
import {
    DocEditorSignatureAction,
    type SigningActionStatus,
} from './DocEditorSignatureAction';
import { ShareDocumentDialog } from './ShareDocumentDialog';
import { InsertImageDialog } from './InsertImageDialog';
import { InsertLinkDialog } from './InsertLinkDialog';
import { MenuDropdown } from './MenuDropdown';
import { EditorUserAvatarMenu } from './EditorUserAvatarMenu';
import { EditorFindBar } from './EditorFindBar';
import { useEditorActions } from '@/store/editor/use-editor-actions';
import { DOCUMENT_IMPORT_ACCEPT } from '@/lib/import-document';

interface DocEditorHeaderProps {
    editor: Editor | null;
    doc: DocumentDetail;
    shareActivityRefreshKey: number;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    editingTitle: boolean;
    title: string;
    onTitleChange: (v: string) => void;
    onTitleSave: () => void | Promise<void>;
    onTitleEditStart: () => void;
    onTitleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    isReadOnly: boolean;
    isLocked: boolean;
    canShare: boolean;
    canComment?: boolean;
    canFinalise: boolean;
    canLock: boolean;
    canSign: boolean;
    canViewSignature: boolean;
    canPrepareSignatureBlocks?: boolean;
    signatureBlockSigners?: SignatureBlockSigner[];
    onPrepareSignatureBlocks?: () => void;
    viewMenuItems: readonly MenuItem[];
    signingStatus: SigningActionStatus;
    isStarred?: boolean;
    onOpenComments?: () => void;
    onCreateComment?: () => void;
    onToggleStar?: () => void;
    onManualSave?: () => void | Promise<void>;
    onShareActivityRecorded: () => void;
    onApplyForDigitalSignature: () => void;
    onCompleteIdentityVerification: () => void;
    onFinalise: () => void;
    onLock: () => void;
    onSign: () => void;
    onViewSignature: () => void;
    onViewAction: (actionId: string) => void;
}

/** Full Google Docs-style two-row sticky header for the document editor. */
export function DocEditorHeader({
    editor, doc, shareActivityRefreshKey, saveStatus, editingTitle, title,
    onTitleChange, onTitleSave, onTitleEditStart, onTitleKeyDown,
    isReadOnly, isLocked, canShare, canComment = false,
    canFinalise, canLock, canSign, canViewSignature,
    canPrepareSignatureBlocks = false, signatureBlockSigners = [], viewMenuItems,
    onPrepareSignatureBlocks, signingStatus, isStarred = false, onOpenComments, onCreateComment, onToggleStar, onManualSave, onShareActivityRecorded,
    onApplyForDigitalSignature, onCompleteIdentityVerification, onFinalise, onLock, onSign, onViewSignature, onViewAction,
}: DocEditorHeaderProps) {
    const [shareOpen, setShareOpen] = useState(false);
    const [findOpen,  setFindOpen]  = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);

    const {
        importing,
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
    } = useEditorActions({
        editor, doc, editingTitle, title, isReadOnly,
        canPrepareSignatureBlocks, signatureBlockSigners, onPrepareSignatureBlocks,
        onTitleEditStart, onTitleSave,
        onFindToggle: () => setFindOpen((v) => !v),
        onViewAction,
        onCreateComment,
    });
    const menuBar = useMemo(() => MENU_BAR.map((menu) => {
        if (menu.label !== 'Insert') return menu;

        return {
            ...menu,
            items: menu.items.map((item) => (
                item.type === 'action' && item.actionId === INSERT_ACTION_IDS.comment
                    ? { ...item, disabled: !canComment }
                    : item
            )),
        };
    }), [canComment]);

    // Focus and select the title input whenever editing begins
    useEffect(() => {
        if (!editingTitle || !titleInputRef.current) return;
        titleInputRef.current.focus();
        titleInputRef.current.select();
    }, [editingTitle]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isFormField = Boolean(target?.closest('input, textarea, select'));

            if (
                !isReadOnly
                && !isFormField
                && (event.metaKey || event.ctrlKey)
                && event.key.toLowerCase() === 'k'
            ) {
                event.preventDefault();
                handleAction('insert:link');
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [handleAction, isReadOnly]);

    const saveLabel = saveStatus === 'saving' ? 'Saving…'
        : saveStatus === 'saved'  ? 'All changes saved'
        : saveStatus === 'error'  ? 'Save failed'
        : '';

    return (
        <div className="ded-header">
            {/* Hidden file input — triggered by File → Open */}
            <input
                ref={fileInputRef}
                type="file"
                accept={DOCUMENT_IMPORT_ACCEPT}
                style={{ display: 'none' }}
                onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileImport(file);
                }}
            />

            {/* ── Import progress banner ── */}
            {importing && (
                <div className="ded-import-banner" role="status" aria-live="polite">
                    <span className="ded-import-banner__spinner" aria-hidden="true" />
                    Importing document…
                </div>
            )}

            {/* ── Row 1: menu bar ── */}
            <div className="ded-menubar">
                {/* Left cluster: back button + document identity */}
                <div className="ded-menubar__left">
                    <Link href="/documents" className="ded-back-btn" aria-label="Back to documents">
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
                    </Link>
                    <div className="ded-doc-identity">
                        <div className="ded-doc-identity__icon"><span>D</span></div>
                        <div className="ded-doc-identity__info">
                            {editingTitle ? (
                                <input
                                    ref={titleInputRef}
                                    value={title}
                                    onChange={e => onTitleChange(e.target.value)}
                                    onBlur={onTitleSave}
                                    onKeyDown={onTitleKeyDown}
                                    className="ded-title-input"
                                />
                            ) : (
                                <button
                                    className="ded-title-btn"
                                    onClick={() => !isReadOnly && onTitleEditStart()}
                                >
                                    {doc.title}
                                </button>
                            )}
                            <div className="ded-doc-identity__meta">
                                <button
                                    className={`ded-icon-btn${isStarred ? ' ded-icon-btn--starred' : ''}`}
                                    title={isStarred ? 'Remove from starred' : 'Add to starred'}
                                    aria-label={isStarred ? `Remove ${doc.title} from starred` : `Add ${doc.title} to starred`}
                                    aria-pressed={isStarred}
                                    onClick={onToggleStar}
                                    disabled={!onToggleStar}
                                >
                                    <HugeiconsIcon
                                        icon={StarIcon}
                                        size={14}
                                        color={isStarred ? '#f59e0b' : 'currentColor'}
                                        fill={isStarred ? '#f59e0b' : 'none'}
                                    />
                                </button>
                                <button
                                    className="ded-icon-btn"
                                    title={isReadOnly ? 'Read-only documents cannot be saved' : 'Save document now'}
                                    aria-label="Save document now"
                                    onClick={onManualSave}
                                    disabled={isReadOnly || !onManualSave || saveStatus === 'saving'}
                                >
                                    <HugeiconsIcon icon={FolderOpenIcon} size={14} />
                                </button>
                                {saveLabel && (
                                    <span className={`ded-save-status ded-save-status--${saveStatus}`}>
                                        {saveLabel}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Menu strip */}
                <nav className="ded-menubar__nav" aria-label="Document menu">
                    {menuBar.map(m => (
                        <MenuDropdown
                            key={m.label}
                            label={m.label}
                            items={m.label === 'View' ? viewMenuItems : m.items}
                            onAction={handleAction}
                        />
                    ))}
                </nav>

                {/* Right actions */}
                <div className="ded-menubar__right">
                    <button className="ded-icon-btn" title="Version history" disabled>
                        <HugeiconsIcon icon={Clock01Icon} size={17} />
                    </button>
                    <button
                        className="ded-icon-btn"
                        title={canComment ? 'Comments' : 'View comments'}
                        disabled={!onOpenComments}
                        onClick={onOpenComments}
                    >
                        <HugeiconsIcon icon={Comment01Icon} size={17} />
                    </button>

                    {!isLocked && (canFinalise || canLock || canSign) && (
                        <DocEditorSignatureAction
                            signingStatus={signingStatus}
                            canFinalise={canFinalise}
                            canLock={canLock}
                            canSign={canSign}
                            onApplyForDigitalSignature={onApplyForDigitalSignature}
                            onCompleteIdentityVerification={onCompleteIdentityVerification}
                            onFinalise={onFinalise}
                            onLock={onLock}
                            onSign={onSign}
                        />
                    )}
                    {canViewSignature && isLocked && (
                        <button onClick={onViewSignature} className="ded-action-btn">
                            View signature
                        </button>
                    )}

                    {canShare && (
                        <button
                            className="ded-share-btn"
                            onClick={() => setShareOpen(true)}
                            title="Share document"
                        >
                            <HugeiconsIcon icon={Share01Icon} size={15} />
                            <span>Share</span>
                        </button>
                    )}

                    <EditorUserAvatarMenu />
                </div>
            </div>

            {/* ── Row 2: formatting toolbar ── */}
            {editor && !isReadOnly && <DocEditorToolbar editor={editor} />}

            {/* ── Row 3: find bar ── */}
            {findOpen && editor && (
                <EditorFindBar editor={editor} onClose={() => setFindOpen(false)} />
            )}

            {/* ── Share dialog ── */}
            {shareOpen && (
                <ShareDocumentDialog
                    documentId={doc.id}
                    docTitle={doc.title}
                    canGrantManageAccess={doc.access?.isOwner ?? true}
                    activityRefreshKey={shareActivityRefreshKey}
                    onActivityRecorded={onShareActivityRecorded}
                    onClose={() => setShareOpen(false)}
                />
            )}

            {linkDialog.open && (
                <InsertLinkDialog
                    open={linkDialog.open}
                    mode={linkDialog.mode}
                    text={linkDialog.text}
                    url={linkDialog.url}
                    error={linkDialog.error}
                    canRemove={linkDialog.canRemove}
                    onClose={closeLinkDialog}
                    onSubmit={submitLinkDialog}
                    onRemove={removeLink}
                />
            )}

            {imageDialog.open && (
                <InsertImageDialog
                    onClose={closeImageDialog}
                    onSubmit={submitImageDialog}
                />
            )}
        </div>
    );
}
