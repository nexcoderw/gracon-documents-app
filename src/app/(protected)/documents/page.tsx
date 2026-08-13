/**
 * DocumentsPage
 *
 * Google Docs-style listing page. Shows a quick-create strip at the top,
 * an enhanced filter bar (status tabs, starred tab, sort selector), and a
 * responsive portrait-thumbnail card grid.
 *
 * Starred documents are bookmarked client-side via localStorage — no backend
 * endpoint required. Sorting is applied client-side on the fetched page.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, toast } from '@/components/ui';
import {
    autosaveDocument,
    createDocument,
    listDocuments, deleteDocument,
    type DocumentListScope, type DocumentSummary, type DocumentStatus,
} from '@/api/documents.api';
import { useStarred } from '@/lib/hooks/useStarred';
import { DOCUMENT_IMPORT_ACCEPT, importDocumentToTiptap } from '@/lib/import-document';
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle';
import {
    DocumentCard, DocumentsFilters, DeleteDocumentDialog,
    type StatusFilter, type SortOption,
} from '@/components/pages/documents';
import styles from './documents-page.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown, fallback: string): string {
    const message = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
}

/**
 * Sorts a document array by the selected sort option.
 * Returns a new array — never mutates the input.
 */
function sortDocuments(items: DocumentSummary[], sort: SortOption): DocumentSummary[] {
    const copy = [...items];
    switch (sort) {
        case 'recent':
            return copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        case 'oldest':
            return copy.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        case 'name-asc':
            return copy.sort((a, b) => a.title.localeCompare(b.title));
        case 'name-desc':
            return copy.sort((a, b) => b.title.localeCompare(a.title));
    }
}

function parseAccessScope(value: string | null): DocumentListScope {
    if (value === 'OWNED' || value === 'SHARED_WITH_ME') return value;
    return 'ALL_ACCESSIBLE';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
    useDocumentTitle('Documents');

    const router = useRouter();
    const searchParams = useSearchParams();
    const search       = searchParams.get('search') ?? '';
    const statusFilter = searchParams.get('status') as DocumentStatus | null;
    const accessScope  = parseAccessScope(searchParams.get('scope'));

    const [items,     setItems]     = useState<DocumentSummary[]>([]);
    const [total,     setTotal]     = useState(0);
    const [page,      setPage]      = useState(1);
    const [loading,   setLoading]   = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [sort,        setSort]        = useState<SortOption>('recent');
    const [starredOnly, setStarredOnly] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
    const [deleting,    setDeleting]    = useState(false);
    const [importing,   setImporting]   = useState(false);
    const latestLoadRef = useRef(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { starredIds, isStarred, toggleStar } = useStarred();

    const load = useCallback(async () => {
        const requestId = ++latestLoadRef.current;
        setLoading(true);
        setLoadError(null);
        try {
            const res = await listDocuments({
                page,
                limit: 20,
                scope:  accessScope,
                type:   'RICH_TEXT',
                search: search || undefined,
                // When starredOnly is on we load all docs then filter client-side
                status: (!starredOnly && statusFilter) ? statusFilter : undefined,
            });
            if (requestId !== latestLoadRef.current) return;
            setItems(res.items);
            setTotal(res.total);
        } catch (error: unknown) {
            if (requestId !== latestLoadRef.current) return;
            const message = getErrorMessage(error, 'Failed to load documents.');
            setLoadError(message);
            toast.error(message);
        } finally {
            if (requestId === latestLoadRef.current) setLoading(false);
        }
    }, [accessScope, page, search, statusFilter, starredOnly]);

    useEffect(() => {
        void load();
        return () => { latestLoadRef.current += 1; };
    }, [load]);

    /** Items after applying client-side starred filter + sort. */
    const visibleItems = useMemo(() => {
        const filtered = starredOnly
            ? items.filter((d) => starredIds.has(d.id))
            : items;
        return sortDocuments(filtered, sort);
    }, [items, sort, starredOnly, starredIds]);

    const starredCount = useMemo(
        () => items.filter((d) => starredIds.has(d.id)).length,
        [items, starredIds],
    );

    /** Opens the confirmation dialog — no API call yet. */
    function handleDeleteRequest(id: string, title: string) {
        setPendingDelete({ id, title });
    }

    /** Called when the user confirms deletion in the dialog. */
    async function handleDeleteConfirm() {
        if (!pendingDelete) return;
        setDeleting(true);
        try {
            await deleteDocument(pendingDelete.id);
            setPendingDelete(null);
            toast.success('Document deleted.');
            void load();
        } catch {
            toast.error('Failed to delete document.');
        } finally {
            setDeleting(false);
        }
    }

    function handleStatusChange(s: StatusFilter) {
        const url = new URL(window.location.href);
        const before = url.pathname + url.search;
        if (s) url.searchParams.set('status', s);
        else   url.searchParams.delete('status');
        const after = url.pathname + url.search;
        setPage(1);
        // Only push if the URL actually changed — a no-op push resets local state.
        if (before !== after) router.push(after);
    }

    function handleAccessScopeChange(scope: DocumentListScope) {
        const url = new URL(window.location.href);
        const before = url.pathname + url.search;
        if (scope === 'ALL_ACCESSIBLE') url.searchParams.delete('scope');
        else url.searchParams.set('scope', scope);
        const after = url.pathname + url.search;
        setPage(1);
        if (before !== after) router.push(after);
    }

    async function handleImport(file: File) {
        setImporting(true);
        const importToastId = toast.loading('Importing document…');

        try {
            const { content, title } = await importDocumentToTiptap(file);
            const doc = await createDocument({ type: 'RICH_TEXT', title });
            await autosaveDocument(doc.id, content);
            toast.dismiss(importToastId);
            toast.success(`"${title}" imported`);
            router.push(`/documents/${doc.id}/edit`);
        } catch (error: unknown) {
            toast.dismiss(importToastId);
            const message = getErrorMessage(error, 'Failed to import document.');
            toast.error(message);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / 20));

    return (
        <div className="animate-fade-up">
            <input
                ref={fileInputRef}
                type="file"
                accept={DOCUMENT_IMPORT_ACCEPT}
                className={styles.hiddenInput}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleImport(file);
                }}
            />

            {/* ── Quick-create strip ── */}
            <div className={styles.createStrip}>
                <p className={styles.createLabel}>Create new</p>
                <div className={styles.createRow}>
                    <Link href="/documents/new" className={styles.createItem} aria-label="Create blank document">
                        <div className={styles.createThumb}>
                            <div className={`${styles.createAccent} ${styles.documentAccent}`} />
                            <div className={`${styles.createLine} ${styles.headingLine}`} />
                            <div className={`${styles.createLine} ${styles.lineFull}`} />
                            <div className={`${styles.createLine} ${styles.lineMedium}`} />
                            <div className={`${styles.createLine} ${styles.lineWide}`} />
                            <div className={`${styles.createLine} ${styles.lineShort}`} />
                        </div>
                        <span className={styles.createItemLabel}>Blank document</span>
                    </Link>

                    <button
                        type="button"
                        className={styles.createItem}
                        aria-label="Import document from your device"
                        disabled={importing}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className={styles.createThumb}>
                            <div className={`${styles.createAccent} ${styles.importAccent}`} />
                            <div className={styles.importIcon} aria-hidden="true">
                                {importing ? '…' : '↓'}
                            </div>
                            <div className={`${styles.createLine} ${styles.headingLine} ${styles.lineImportHeading}`} />
                            <div className={`${styles.createLine} ${styles.lineFull}`} />
                            <div className={`${styles.createLine} ${styles.lineImportWide}`} />
                            <div className={`${styles.createLine} ${styles.lineImportShort}`} />
                        </div>
                        <span className={styles.createItemLabel}>
                            {importing ? 'Importing…' : 'Import document'}
                        </span>
                    </button>
                </div>
            </div>

            {/* ── Filters bar ── */}
            <DocumentsFilters
                accessScope={accessScope}
                statusFilter={statusFilter}
                starredOnly={starredOnly}
                starredCount={starredCount}
                sort={sort}
                total={starredOnly ? visibleItems.length : total}
                loading={loading}
                search={search}
                onAccessScopeChange={handleAccessScopeChange}
                onStatusChange={handleStatusChange}
                onStarredChange={setStarredOnly}
                onSortChange={setSort}
            />

            {/* ── Document grid ── */}
            {loading ? (
                <div className={styles.skeletonGrid} aria-label="Loading documents">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className={styles.skeletonCard} />
                    ))}
                </div>
            ) : loadError ? (
                <Card className={styles.errorCard}>
                    <div>
                        <p className={styles.errorTitle}>
                            Unable to load your documents
                        </p>
                        <p className={styles.errorCopy}>{loadError}</p>
                    </div>
                    <div className={styles.errorActions}>
                        <Button onClick={() => void load()} size="sm">
                            Try again
                        </Button>
                        <Link href="/documents/new" className={`${styles.actionLink} ${styles.secondaryAction}`}>
                            Create a document
                        </Link>
                    </div>
                </Card>
            ) : visibleItems.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>
                        <div className={styles.emptyIconStripe} />
                        <div className={`${styles.emptyIconLine} ${styles.emptyIconHeading}`} />
                        <div className={`${styles.emptyIconLine} ${styles.lineFull}`} />
                        <div className={`${styles.emptyIconLine} ${styles.lineMedium}`} />
                        <div className={`${styles.emptyIconLine} ${styles.lineWide}`} />
                    </div>
                    <p className={styles.emptyHeading}>
                        {starredOnly
                            ? 'No starred documents'
                            : search
                                ? 'No results found'
                                : accessScope === 'SHARED_WITH_ME'
                                    ? 'No shared documents yet'
                                    : statusFilter
                                    ? `No ${statusFilter.toLowerCase()} documents`
                                    : 'No documents yet'}
                    </p>
                    <p className={styles.emptyCopy}>
                        {starredOnly
                            ? 'Star a document to add it to your favourites.'
                            : search
                                ? `No documents match "${search}"`
                                : accessScope === 'SHARED_WITH_ME'
                                    ? 'Documents shared with you will appear here after you accept their invitation.'
                                    : statusFilter
                                    ? 'Documents with this status will appear here.'
                                    : 'Create your first document to get started.'}
                    </p>
                    {!search && !statusFilter && !starredOnly && (
                        <Link href="/documents/new" className={`${styles.actionLink} ${styles.primaryAction}`}>
                            Create document
                        </Link>
                    )}
                </div>
            ) : (
                <div className={styles.documentGrid}>
                    {visibleItems.map((doc) => (
                        <DocumentCard
                            key={doc.id}
                            doc={doc}
                            starred={isStarred(doc.id)}
                            onDelete={handleDeleteRequest}
                            onToggleStar={toggleStar}
                        />
                    ))}
                </div>
            )}

            {/* ── Pagination ── */}
            {!starredOnly && totalPages > 1 && (
                <div className={styles.pagination}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        ← Prev
                    </Button>
                    <span className={styles.paginationLabel}>Page {page} of {totalPages}</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Next →
                    </Button>
                </div>
            )}

            {/* ── Delete confirmation dialog ── */}
            {pendingDelete && (
                <DeleteDocumentDialog
                    docTitle={pendingDelete.title}
                    deleting={deleting}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => { if (!deleting) setPendingDelete(null); }}
                />
            )}
        </div>
    );
}
