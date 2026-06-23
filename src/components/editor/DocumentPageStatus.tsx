/**
 * Floating page status for measured editor pagination.
 */
'use client';

import type { TiptapPaginationMetrics } from '@/lib/tiptap/tiptap-page-metrics';
import styles from './DocumentPageStatus.module.css';

interface DocumentPageStatusProps {
    metrics: TiptapPaginationMetrics;
}

/**
 * Renders the active page and measured page count without changing editor data.
 *
 * @param props - Measured TipTap pagination metrics.
 * @returns A non-interactive page status chip.
 */
export function DocumentPageStatus({ metrics }: DocumentPageStatusProps) {
    const overflowingPages = metrics.pages.filter((page) => page.overflow).length;
    const hasOverflow = overflowingPages > 0;

    return (
        <div className={styles.status} role="status" aria-live="polite">
            <span className={styles.label}>
                Page {metrics.activePage} of {metrics.pageCount}
            </span>
            <span className={`${styles.meta}${hasOverflow ? ` ${styles.warning}` : ''}`}>
                {hasOverflow
                    ? `${overflowingPages} page${overflowingPages === 1 ? '' : 's'} need review`
                    : 'Live layout'}
            </span>
        </div>
    );
}
