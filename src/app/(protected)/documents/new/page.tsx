/**
 * NewDocumentPage
 *
 * Lets the user start a blank rich-text document or choose from templates.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, toast } from '@/components/ui';
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle';
import {
    createDocument,
    listTemplates,
    type Template,
} from '@/api/documents.api';
import styles from './NewDocumentPage.module.css';

export default function NewDocumentPage() {
    useDocumentTitle('New Document');

    const router = useRouter();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        listTemplates({ type: 'RICH_TEXT' })
            .then(setTemplates)
            .catch(() => {
                toast.error('Failed to load templates.');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    async function handleCreate(templateId?: string) {
        setCreating(true);
        try {
            const doc = await createDocument({ type: 'RICH_TEXT', templateId });
            router.replace(`/documents/${doc.id}/edit`);
        } catch {
            toast.error('Failed to create document.');
            setCreating(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>
                    New Document
                </h1>
                <p className={styles.subtitle}>
                    Start a rich text document from a blank page or a template.
                </p>
            </div>

            {/* Blank option */}
            <div>
                <Button
                    onClick={() => handleCreate()}
                    disabled={creating}
                    fullWidth
                    size="lg"
                    loading={creating}
                    loadingText="Creating…"
                >
                    Start with Blank Document
                </Button>
            </div>

            {/* Templates */}
            {!loading && templates.length > 0 && (
                <section className={styles.templateSection}>
                    <h2 className={styles.sectionTitle}>
                        Or start from a template
                    </h2>
                    <div className={styles.grid}>
                        {templates.map((template) => (
                            <button key={template.id} onClick={() => handleCreate(template.id)} disabled={creating} className={styles.template}>
                                <div className={styles.templateName}>{template.name}</div>
                                <div className={styles.templateDescription}>{template.description}</div>
                                <div className={styles.templateAction}>Use template →</div>
                            </button>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
