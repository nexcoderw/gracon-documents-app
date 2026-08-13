'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { uploadEditorImage } from '@/api/editor-images.api';
import { normalizeEditorImageUrl } from '@/lib/editor-image';
import { Button } from '@/components/ui';
import styles from './InsertImageDialog.module.css';

export interface InsertImageDialogValues {
    alt: string;
    src: string;
    title: string;
}

interface InsertImageDialogProps {
    initialAlt?: string;
    initialSrc?: string;
    initialTitle?: string;
    onClose: () => void;
    onSubmit: (values: InsertImageDialogValues) => void;
}

type ImageTab = 'upload' | 'url';
type PreviewStatus = 'idle' | 'loading' | 'loaded' | 'error';

const MAX_LOCAL_IMAGE_BYTES = 8 * 1024 * 1024;
const LOCAL_IMAGE_TYPES = new Set([
    'image/avif',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
]);

function ImageIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
                d="M4 3.5h12A2.5 2.5 0 0 1 18.5 6v8A2.5 2.5 0 0 1 16 16.5H4A2.5 2.5 0 0 1 1.5 14V6A2.5 2.5 0 0 1 4 3.5Zm0 1.5A1 1 0 0 0 3 6v6.24l3.02-2.64a1.75 1.75 0 0 1 2.37.06l1.22 1.17 2.3-2.82a1.75 1.75 0 0 1 2.68-.05L17 10.73V6a1 1 0 0 0-1-1H4Zm13 8.05-3.54-4.08a.25.25 0 0 0-.38.01l-3.31 4.06-2.42-2.31a.25.25 0 0 0-.34-.01L3 14.23A1 1 0 0 0 4 15h12a1 1 0 0 0 1-.95v-1ZM6.75 8.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
                fill="currentColor"
            />
        </svg>
    );
}

function UploadIcon() {
    return (
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
                d="M10 13V3m0 0L6.25 6.75M10 3l3.75 3.75M4 13.75v.75A2.5 2.5 0 0 0 6.5 17h7a2.5 2.5 0 0 0 2.5-2.5v-.75"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function validateLocalImage(file: File) {
    if (!LOCAL_IMAGE_TYPES.has(file.type)) {
        return 'Only AVIF, GIF, JPEG, PNG, and WebP images are allowed.';
    }
    if (file.size <= 0 || file.size > MAX_LOCAL_IMAGE_BYTES) {
        return 'Image must be smaller than 8 MB.';
    }
    return null;
}

/**
 * Dialog for inserting hosted or locally uploaded images into the editor.
 */
export function InsertImageDialog({
    initialAlt = '',
    initialSrc = '',
    initialTitle = '',
    onClose,
    onSubmit,
}: InsertImageDialogProps) {
    const [activeTab, setActiveTab] = useState<ImageTab>('upload');
    const [src, setSrc] = useState(initialSrc);
    const [alt, setAlt] = useState(initialAlt);
    const [title, setTitle] = useState(initialTitle);
    const [touched, setTouched] = useState(false);
    const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [localPreviewUrl, setLocalPreviewUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const normalized = useMemo(() => normalizeEditorImageUrl(src), [src]);
    const showUrlError = touched && src.trim().length > 0 && !normalized.ok;
    const previewUrl = activeTab === 'upload' ? localPreviewUrl : normalized.ok ? normalized.url : '';
    const canSubmitUrl = normalized.ok && previewStatus !== 'error';
    const canUpload = Boolean(selectedFile) && !uploading && !uploadError && previewStatus !== 'error';

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        return () => {
            if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
        };
    }, [localPreviewUrl]);

    const chooseLocalFile = (file: File | null) => {
        setUploadError(null);
        setSelectedFile(null);
        setPreviewStatus('idle');

        if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl('');

        if (!file) return;

        const validationError = validateLocalImage(file);
        if (validationError) {
            setUploadError(validationError);
            return;
        }

        setSelectedFile(file);
        setPreviewStatus('loading');
        setLocalPreviewUrl(URL.createObjectURL(file));
        if (!alt.trim()) {
            setAlt(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
        }
    };

    const uploadAndInsert = async () => {
        if (!selectedFile) {
            setUploadError('Choose an image from your computer first.');
            return;
        }

        setUploading(true);
        setUploadError(null);
        try {
            const uploaded = await uploadEditorImage(selectedFile);
            onSubmit({
                src: uploaded.url,
                alt: alt.trim(),
                title: title.trim(),
            });
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : 'Failed to upload image.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div
            className={styles.backdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="insert-image-dialog-title"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !uploading) onClose();
            }}
        >
            <form
                className={styles.dialog}
                onSubmit={(event) => {
                    event.preventDefault();
                    if (activeTab === 'upload') {
                        void uploadAndInsert();
                        return;
                    }
                    if (!normalized.ok) {
                        setTouched(true);
                        return;
                    }
                    onSubmit({ src: normalized.url, alt: alt.trim(), title: title.trim() });
                }}
            >
                <div className={styles.header}>
                    <div className={styles.headerIcon} aria-hidden="true">
                        <ImageIcon />
                    </div>
                    <div className={styles.headerCopy}>
                        <p className={styles.eyebrow}>Image</p>
                        <h2 id="insert-image-dialog-title" className={styles.title}>
                            Insert image
                        </h2>
                    </div>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        disabled={uploading}
                        aria-label="Close image dialog"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <p className={styles.copy}>
                    Upload a local image to private document storage or insert an existing secure hosted URL. The document stores only a stable image URL.
                </p>

                <div className={styles.tabs} role="tablist" aria-label="Image source">
                    <button
                        type="button"
                        className={`${styles.tab}${activeTab === 'upload' ? ` ${styles.activeTab}` : ''}`}
                        onClick={() => setActiveTab('upload')}
                    >
                        Upload
                    </button>
                    <button
                        type="button"
                        className={`${styles.tab}${activeTab === 'url' ? ` ${styles.activeTab}` : ''}`}
                        onClick={() => setActiveTab('url')}
                    >
                        Image URL
                    </button>
                </div>

                {activeTab === 'upload' ? (
                    <div className={styles.uploadPanel}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                            className={styles.fileInput}
                            onChange={(event) => chooseLocalFile(event.target.files?.[0] ?? null)}
                        />
                        <button
                            type="button"
                            className={styles.dropzone}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                                event.preventDefault();
                                chooseLocalFile(event.dataTransfer.files?.[0] ?? null);
                            }}
                        >
                            <span className={styles.dropzoneIcon}>
                                <UploadIcon />
                            </span>
                            <strong>{selectedFile ? selectedFile.name : 'Choose or drop an image'}</strong>
                            <small>
                                {selectedFile
                                    ? `${selectedFile.type.replace('image/', '').toUpperCase()} · ${formatBytes(selectedFile.size)}`
                                    : 'AVIF, GIF, JPEG, PNG, or WebP up to 8 MB'}
                            </small>
                        </button>
                    </div>
                ) : (
                    <label className={`${styles.field}${showUrlError ? ` ${styles.fieldError}` : ''}`}>
                        <span>Image URL</span>
                        <input
                            value={src}
                            onChange={(event) => {
                                setSrc(event.target.value);
                                setTouched(true);
                                setPreviewStatus('loading');
                            }}
                            onBlur={() => setTouched(true)}
                            placeholder="https://cdn.example.com/path/image.jpg"
                            inputMode="url"
                            autoComplete="url"
                        />
                        <small className={showUrlError ? styles.errorHint : undefined}>
                            {showUrlError
                                ? normalized.error
                                : 'Allowed: secure hosted image URLs. SVG and base64 images are not accepted.'}
                        </small>
                    </label>
                )}

                <div className={styles.preview}>
                    {previewUrl ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic editor image preview cannot use Next/Image without domain allowlisting. */}
                            <img
                                src={previewUrl}
                                alt=""
                                onLoad={() => setPreviewStatus('loaded')}
                                onError={() => setPreviewStatus('error')}
                            />
                            {previewStatus === 'loading' && (
                                <span className={styles.previewStatus}>Checking image…</span>
                            )}
                            {previewStatus === 'error' && (
                                <span className={`${styles.previewStatus} ${styles.previewError}`}>
                                    This image could not be loaded.
                                </span>
                            )}
                        </>
                    ) : (
                        <div className={styles.previewEmpty}>
                            <ImageIcon />
                            <span>Image preview will appear here</span>
                        </div>
                    )}
                </div>

                <div className={styles.metaGrid}>
                    <label className={styles.field}>
                        <span>Alt text</span>
                        <input
                            value={alt}
                            onChange={(event) => setAlt(event.target.value)}
                            placeholder="Describe the image for accessibility"
                        />
                    </label>
                    <label className={styles.field}>
                        <span>Title</span>
                        <input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Optional hover title"
                        />
                    </label>
                </div>

                {uploadError && (
                    <p className={styles.error} role="alert">
                        {uploadError}
                    </p>
                )}

                <div className={styles.footer}>
                    <p>
                        {activeTab === 'upload'
                            ? 'Upload stores the image privately in the documents API and returns a stable render URL.'
                            : 'External images remain hosted by their original provider.'}
                    </p>
                    <div className={styles.footerActions}>
                        <Button type="button" variant="ghost" onClick={onClose} disabled={uploading}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={activeTab === 'upload' ? !canUpload : !canSubmitUrl}
                            loading={uploading}
                            loadingText="Uploading…"
                        >
                            Insert image
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
