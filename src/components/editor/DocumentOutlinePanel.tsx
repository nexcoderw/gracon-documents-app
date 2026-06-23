/**
 * Heading outline navigation for the live document editor.
 */
'use client';

import { useState } from 'react';
import type { TiptapOutlineMetric } from '@/lib/tiptap/tiptap-page-metrics';
import styles from './DocumentOutlinePanel.module.css';

interface DocumentOutlinePanelProps {
    outline: TiptapOutlineMetric[];
    activePage: number;
    onSelect: (item: TiptapOutlineMetric) => void;
}

/**
 * Renders a collapsible heading outline derived from live page metrics.
 *
 * @param props - Outline items, active page, and selection callback.
 * @returns A side rail for heading navigation.
 */
export function DocumentOutlinePanel({
    outline,
    activePage,
    onSelect,
}: DocumentOutlinePanelProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={`${styles.panel}${collapsed ? ` ${styles.collapsed}` : ''}`}
            aria-label="Document outline"
        >
            <div className={styles.header}>
                {!collapsed && <h2 className={styles.title}>Outline</h2>}
                <button
                    type="button"
                    className={styles.toggle}
                    onClick={() => setCollapsed((current) => !current)}
                    aria-label={collapsed ? 'Expand document outline' : 'Collapse document outline'}
                    title={collapsed ? 'Expand outline' : 'Collapse outline'}
                >
                    {collapsed ? '›' : '‹'}
                </button>
            </div>

            {!collapsed && (
                <div className={styles.list}>
                    {outline.length === 0 ? (
                        <p className={styles.empty}>Add headings to build an outline.</p>
                    ) : (
                        outline.map((item) => (
                            <button
                                key={`${item.id}:${item.page}:${item.top}`}
                                type="button"
                                className={`${styles.item}${item.page === activePage ? ` ${styles.itemActive}` : ''}`}
                                onClick={() => onSelect(item)}
                                title={item.label}
                            >
                                <span className={styles.label}>{item.label}</span>
                                <span className={styles.page}>p. {item.page}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </aside>
    );
}
