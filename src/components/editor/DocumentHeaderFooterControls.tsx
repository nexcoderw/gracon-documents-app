'use client';

import type { DocumentHeaderFooter } from '@/lib/document-layout';
import styles from './DocumentHeaderFooterControls.module.css';

interface DocumentHeaderFooterControlsProps {
    value: DocumentHeaderFooter;
    saving: boolean;
    onChange: (value: DocumentHeaderFooter) => void;
}

type ToggleField = 'headerEnabled' | 'footerEnabled' | 'pageNumbersEnabled';
type TextField = 'headerText' | 'footerText';

function getToggleLabel(field: ToggleField) {
    if (field === 'headerEnabled') return 'Show header';
    if (field === 'footerEnabled') return 'Show footer';
    return 'Show page numbers';
}

export function DocumentHeaderFooterControls({
    value,
    saving,
    onChange,
}: DocumentHeaderFooterControlsProps) {
    function updateToggle(field: ToggleField, checked: boolean) {
        onChange({ ...value, [field]: checked });
    }

    function updateText(field: TextField, text: string) {
        onChange({ ...value, [field]: text.slice(0, 120) });
    }

    return (
        <div className={styles.section}>
            <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>Headers and footers</span>
                <p className={styles.sectionCopy}>
                    Configure repeated page chrome. Page numbers update automatically per page.
                </p>
            </div>

            <div className={styles.toggleRow}>
                {(['headerEnabled', 'footerEnabled', 'pageNumbersEnabled'] as ToggleField[]).map((field) => (
                    <label key={field} className={styles.toggle}>
                        <input
                            type="checkbox"
                            checked={value[field]}
                            onChange={(event) => updateToggle(field, event.target.checked)}
                            disabled={saving}
                        />
                        <span>{getToggleLabel(field)}</span>
                    </label>
                ))}
            </div>

            <div className={styles.grid}>
                {(['headerText', 'footerText'] as TextField[]).map((field) => (
                    <label key={field} className={styles.field}>
                        <span>{field === 'headerText' ? 'Header text' : 'Footer text'}</span>
                        <div className={styles.fieldInput}>
                            <input
                                type="text"
                                maxLength={120}
                                value={value[field]}
                                placeholder={field === 'headerText' ? 'Defaults to document title' : 'Defaults to document status'}
                                onChange={(event) => updateText(field, event.target.value)}
                                disabled={saving}
                            />
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}
