'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, toast } from '@/components/ui';
import { listTemplates, createDocument, type Template } from '@/api/documents.api';
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle';
import styles from './templates-page.module.css';

const CATEGORY_LABELS: Record<string, string> = {
    CONTRACT: 'Contracts',
    LEGAL: 'Legal',
    FINANCIAL: 'Financial',
    CORRESPONDENCE: 'Correspondence',
    RESOLUTION: 'Resolutions',
    OTHER: 'Other',
};

export default function TemplatesPage() {
    useDocumentTitle('Templates');

    const router = useRouter();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState<string | null>(null);
    const [category, setCategory] = useState<string | null>(null);

    useEffect(() => {
        listTemplates({ type: 'RICH_TEXT' })
            .then(setTemplates)
            .catch(() => toast.error('Failed to load templates.'))
            .finally(() => setLoading(false));
    }, []);

    async function handleUse(templateId: string) {
        setCreating(templateId);
        try {
            const doc = await createDocument({ type: 'RICH_TEXT', templateId });
            router.push(`/documents/${doc.id}/edit`);
        } catch { toast.error('Failed to create from template.'); setCreating(null); }
    }

    const categories = [...new Set(templates.map(t => t.category))];
    const filtered = category ? templates.filter(t => t.category === category) : templates;

    return (
        <div className={`animate-fade-up ${styles.page}`}>
            <div className={styles.header}>
                <h1 className={styles.title}>Templates</h1>
                <p className={styles.subtitle}>
                    Start with a professionally structured template. Your verified identity is automatically filled in.
                </p>
            </div>

            {/* Category filter */}
            <div className={styles.categoryRow}>
                <button
                    onClick={() => setCategory(null)}
                    className={`${styles.categoryButton}${!category ? ` ${styles.categoryButtonActive}` : ''}`}
                >
                    All
                </button>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`${styles.categoryButton}${category === cat ? ` ${styles.categoryButtonActive}` : ''}`}
                    >
                        {CATEGORY_LABELS[cat] ?? cat}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className={styles.grid}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Card key={i} padding="none" className={styles.skeletonCard} />
                    ))}
                </div>
            ) : (
                <div className={styles.grid}>
                    {filtered.map(t => (
                        <Card key={t.id} className={styles.templateCard}>
                            <div className={styles.templateHeader}>
                                <span className={styles.templateIcon}>📄</span>
                                <span className={styles.categoryBadge}>
                                    {CATEGORY_LABELS[t.category] ?? t.category}
                                </span>
                            </div>

                            <div>
                                <p className={styles.templateName}>{t.name}</p>
                                <p className={styles.templateDescription}>{t.description}</p>
                            </div>

                            <div className={styles.templateFooter}>
                                <span className={styles.usageCount}>
                                    Used {t.usageCount.toLocaleString()} times
                                </span>
                                <Button
                                    onClick={() => handleUse(t.id)}
                                    disabled={creating === t.id}
                                    size="sm"
                                >
                                    {creating === t.id ? 'Creating…' : 'Use →'}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
