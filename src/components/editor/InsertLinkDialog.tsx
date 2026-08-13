'use client';

/**
 * Selection-aware link dialog used by Insert -> Link and the keyboard shortcut.
 *
 * Supports create and edit modes. Detects web URLs vs email addresses, shows
 * a real-time validity indicator, and renders an inline preview of how the
 * link will appear in the document before submission.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import styles from './InsertLinkDialog.module.css';

export interface InsertLinkDialogValues {
    text: string;
    url: string;
}

interface InsertLinkDialogProps {
    open: boolean;
    mode: 'create' | 'edit';
    text: string;
    url: string;
    error: string | null;
    canRemove: boolean;
    onClose: () => void;
    onSubmit: (values: InsertLinkDialogValues) => void;
    onRemove: () => void;
}

type LinkType = 'url' | 'email' | null;

/**
 * Loosely detects whether a draft value looks like a web URL or email address.
 * Returns null when the value is empty or unrecognisable.
 */
function detectLinkType(value: string): LinkType {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^mailto:/i.test(trimmed) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return 'email';
    try {
        const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        const parsed = new URL(withScheme);
        if (parsed.hostname.includes('.')) return 'url';
    } catch {
        // not a recognisable URL — fall through
    }
    return null;
}

/** SVG chain-link icon for the URL input. */
function LinkIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
                d="M8.636 3.5a.5.5 0 0 0-.5-.5H5.5A2.5 2.5 0 0 0 3 5.5v9A2.5 2.5 0 0 0 5.5 17h9a2.5 2.5 0 0 0 2.5-2.5v-2.636a.5.5 0 0 0-1 0V14.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5v-9A1.5 1.5 0 0 1 5.5 4h2.636a.5.5 0 0 0 .5-.5ZM11.5 2a.5.5 0 0 0 0 1h2.793L9.146 8.146a.5.5 0 1 0 .708.708L15 3.707V6.5a.5.5 0 0 0 1 0v-4a.5.5 0 0 0-.5-.5h-4Z"
                fill="currentColor"
            />
        </svg>
    );
}

/** SVG at-sign icon for the email input. */
function MailIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
                d="M2.003 5.884 10 9.882l7.997-3.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884Z"
                fill="currentColor"
            />
            <path
                d="M18 8.118l-8 4-8-4V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118Z"
                fill="currentColor"
            />
        </svg>
    );
}

/** SVG checkmark for the valid-URL indicator. */
function CheckIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M13.5 4L6 11.5 2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/**
 * Modal dialog for creating or editing a hyperlink within the document editor.
 *
 * @param open - Whether the dialog is currently visible.
 * @param mode - 'create' for new links, 'edit' for modifying an existing one.
 * @param text - Current display-text value pre-populated from the editor selection.
 * @param url - Current URL value pre-populated from the active link mark.
 * @param error - Validation or submission error surfaced by the parent handler.
 * @param canRemove - Whether to show the "Remove link" destructive action.
 * @param onClose - Invoked when the user dismisses the dialog without saving.
 * @param onSubmit - Invoked with the final { text, url } values when the form submits.
 * @param onRemove - Invoked when the user clicks "Remove link".
 */
export function InsertLinkDialog({
    open,
    mode,
    text,
    url,
    error,
    canRemove,
    onClose,
    onSubmit,
    onRemove,
}: InsertLinkDialogProps) {
    const [draftText, setDraftText] = useState(text);
    const [draftUrl, setDraftUrl] = useState(url);
    const [urlTouched, setUrlTouched] = useState(false);
    const urlInputRef = useRef<HTMLInputElement>(null);
    const textInputRef = useRef<HTMLInputElement>(null);

    // Sync externally selected link values whenever the dialog is opened or the
    // editor selection changes while it remains open.
    /* eslint-disable react-hooks/set-state-in-effect -- Draft state intentionally resets from the current editor selection when this modal opens. */
    useEffect(() => {
        if (!open) return;
        setDraftText(text);
        setDraftUrl(url);
        setUrlTouched(false);
        window.setTimeout(() => {
            // If a URL is already filled but text is missing, jump straight to text.
            if (url && !text) {
                textInputRef.current?.focus();
            } else {
                urlInputRef.current?.focus();
            }
        }, 0);
    }, [open, text, url]);
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, open]);

    const linkType = useMemo<LinkType>(() => detectLinkType(draftUrl), [draftUrl]);
    const isValidUrl = linkType !== null;
    const showInlineError = urlTouched && draftUrl.trim().length > 0 && !isValidUrl;
    const canSubmit = draftUrl.trim().length > 0;

    /** The text that will actually appear in the document — falls back to the URL. */
    const previewLabel = draftText.trim() || draftUrl.trim();

    if (!open) return null;

    return (
        <div
            className={styles.backdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="insert-link-dialog-title"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <form
                className={styles.dialog}
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit({ text: draftText, url: draftUrl });
                }}
            >
                {/* ── Header ── */}
                <div className={styles.header}>
                    <div className={styles.headerIcon} aria-hidden="true">
                        {linkType === 'email' ? <MailIcon /> : <LinkIcon />}
                    </div>
                    <div className={styles.headerCopy}>
                        <p className={styles.eyebrow}>
                            {linkType === 'email' ? 'Email link' : 'Hyperlink'}
                        </p>
                        <h2 id="insert-link-dialog-title" className={styles.title}>
                            {mode === 'edit' ? 'Edit link' : 'Add a link'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        aria-label="Close link dialog"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <p className={styles.copy}>
                    Enter a web address or email. The display text controls what readers see in the document.
                </p>

                {/* ── URL field ── */}
                <label
                    className={[
                        styles.field,
                        isValidUrl ? styles.valid : '',
                        showInlineError ? styles.invalid : '',
                    ].filter(Boolean).join(' ')}
                >
                    <span className={styles.fieldLabel}>
                        URL or email address
                        {linkType && (
                            <span className={`${styles.typeBadge}${linkType === 'email' ? ` ${styles.emailBadge}` : ''}`}>
                                {linkType === 'email' ? 'Email' : 'Web link'}
                            </span>
                        )}
                    </span>
                    <div className={styles.inputWrap}>
                        <span className={styles.inputIcon}>
                            {linkType === 'email' ? <MailIcon /> : <LinkIcon />}
                        </span>
                        <input
                            ref={urlInputRef}
                            value={draftUrl}
                            onChange={(event) => {
                                setDraftUrl(event.target.value);
                                setUrlTouched(true);
                            }}
                            onBlur={() => setUrlTouched(true)}
                            placeholder="https://example.com or name@example.com"
                            inputMode="url"
                            autoComplete="url"
                            aria-describedby={showInlineError ? 'insert-link-url-error' : undefined}
                        />
                        {isValidUrl && (
                            <span className={styles.inputCheck}>
                                <CheckIcon />
                            </span>
                        )}
                    </div>
                    {showInlineError && (
                        <small id="insert-link-url-error" className={`${styles.hint} ${styles.errorHint}`}>
                            Please enter a valid URL (https://…) or email address.
                        </small>
                    )}
                </label>

                {/* ── Display text field ── */}
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>Display text</span>
                    <input
                        ref={textInputRef}
                        value={draftText}
                        onChange={(event) => setDraftText(event.target.value)}
                        placeholder="Text shown in the document"
                    />
                    <small className={styles.hint}>
                        Leave blank to display the URL itself.
                    </small>
                </label>

                {/* ── Inline preview ── */}
                {isValidUrl && previewLabel && (
                    <div className={styles.preview} aria-label="Link preview">
                        <span className={styles.previewLabel}>Preview</span>
                        <span className={styles.previewLink}>{previewLabel}</span>
                    </div>
                )}

                {/* ── Submission error ── */}
                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}

                {/* ── Footer ── */}
                <div className={styles.footer}>
                    {canRemove ? (
                        <button
                            type="button"
                            className={styles.remove}
                            onClick={onRemove}
                        >
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Remove link
                        </button>
                    ) : (
                        <span />
                    )}
                    <div className={styles.footerActions}>
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!canSubmit}
                        >
                            {mode === 'edit' ? 'Apply changes' : 'Insert link'}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
