'use client';

/**
 * Modal editor for persisted page margins.
 *
 * This is the user-facing control surface for the document layout model.
 * It updates the same layout data consumed by the editor paper, ruler, PDF,
 * and DOCX export layers so page geometry stays consistent.
 */
import { useMemo, useState } from 'react';
import type { DocumentLayout } from '@/lib/document-layout';
import { DocumentHeaderFooterControls } from './DocumentHeaderFooterControls';
import { Button } from '@/components/ui';
import styles from './DocumentPageSetupDialog.module.css';

interface DocumentPageSetupDialogProps {
    layout: DocumentLayout;
    saving: boolean;
    onClose: () => void;
    onSave: (layout: DocumentLayout) => void | Promise<void>;
}

type MarginField = 'top' | 'right' | 'bottom' | 'left';

const DPI = 96;
const A4_WIDTH_IN = 8.27;
const A4_HEIGHT_IN = 11.69;
const PRESETS: Array<{ label: string; inches: number }> = [
    { label: 'Narrow', inches: 0.5 },
    { label: 'Normal', inches: 1 },
    { label: 'Wide', inches: 1.5 },
];

function pxToInches(px: number) {
    return Number((px / DPI).toFixed(2));
}

function inchesToPx(inches: number) {
    return Math.round(inches * DPI);
}

function clampInches(value: number) {
    return Math.min(2, Math.max(0.5, Number(value.toFixed(2))));
}

export function DocumentPageSetupDialog({
    layout,
    saving,
    onClose,
    onSave,
}: DocumentPageSetupDialogProps) {
    const [margins, setMargins] = useState({
        top: pxToInches(layout.margins.top).toFixed(2),
        right: pxToInches(layout.margins.right).toFixed(2),
        bottom: pxToInches(layout.margins.bottom).toFixed(2),
        left: pxToInches(layout.margins.left).toFixed(2),
    });
    const [headerFooter, setHeaderFooter] = useState(layout.headerFooter);

    const parsedMargins = useMemo(() => {
        const parseValue = (value: string, fallback: number) => {
            const parsed = Number.parseFloat(value);
            if (!Number.isFinite(parsed)) return fallback;
            return clampInches(parsed);
        };

        return {
            top: parseValue(margins.top, pxToInches(layout.margins.top)),
            right: parseValue(margins.right, pxToInches(layout.margins.right)),
            bottom: parseValue(margins.bottom, pxToInches(layout.margins.bottom)),
            left: parseValue(margins.left, pxToInches(layout.margins.left)),
        };
    }, [layout.margins.bottom, layout.margins.left, layout.margins.right, layout.margins.top, margins]);

    const hasMarginChanges = useMemo(() => (
        inchesToPx(parsedMargins.top) !== layout.margins.top ||
        inchesToPx(parsedMargins.right) !== layout.margins.right ||
        inchesToPx(parsedMargins.bottom) !== layout.margins.bottom ||
        inchesToPx(parsedMargins.left) !== layout.margins.left
    ), [layout.margins.bottom, layout.margins.left, layout.margins.right, layout.margins.top, parsedMargins]);
    const hasHeaderFooterChanges = useMemo(() => (
        headerFooter.headerEnabled !== layout.headerFooter.headerEnabled ||
        headerFooter.footerEnabled !== layout.headerFooter.footerEnabled ||
        headerFooter.pageNumbersEnabled !== layout.headerFooter.pageNumbersEnabled ||
        headerFooter.headerText !== layout.headerFooter.headerText ||
        headerFooter.footerText !== layout.headerFooter.footerText
    ), [headerFooter, layout.headerFooter]);
    const hasChanges = hasMarginChanges || hasHeaderFooterChanges;

    const activePreset = useMemo(() => (
        PRESETS.find((preset) => (
            parsedMargins.top === preset.inches &&
            parsedMargins.right === preset.inches &&
            parsedMargins.bottom === preset.inches &&
            parsedMargins.left === preset.inches
        ))?.label ?? null
    ), [parsedMargins.bottom, parsedMargins.left, parsedMargins.right, parsedMargins.top]);

    const printableWidth = useMemo(
        () => Math.max(0, Number((A4_WIDTH_IN - parsedMargins.left - parsedMargins.right).toFixed(2))),
        [parsedMargins.left, parsedMargins.right],
    );
    const printableHeight = useMemo(
        () => Math.max(0, Number((A4_HEIGHT_IN - parsedMargins.top - parsedMargins.bottom).toFixed(2))),
        [parsedMargins.bottom, parsedMargins.top],
    );

    function handleMarginChange(field: MarginField, value: string) {
        setMargins((current) => ({ ...current, [field]: value }));
    }

    function applyPreset(inches: number) {
        const value = clampInches(inches).toFixed(2);
        setMargins({
            top: value,
            right: value,
            bottom: value,
            left: value,
        });
    }

    function submit() {
        void onSave({
            paperSize: 'A4',
            margins: {
                top: inchesToPx(parsedMargins.top),
                right: inchesToPx(parsedMargins.right),
                bottom: inchesToPx(parsedMargins.bottom),
                left: inchesToPx(parsedMargins.left),
            },
            headerFooter,
        });
    }

    const previewStyle = {
        top: `${(parsedMargins.top / A4_HEIGHT_IN) * 100}%`,
        right: `${(parsedMargins.right / A4_WIDTH_IN) * 100}%`,
        bottom: `${(parsedMargins.bottom / A4_HEIGHT_IN) * 100}%`,
        left: `${(parsedMargins.left / A4_WIDTH_IN) * 100}%`,
    };

    return (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="docs-page-setup-title">
            <div className={styles.dialog}>
                <div className={styles.header}>
                    <div className={styles.headerCopy}>
                        <p className={styles.eyebrow}>Page layout</p>
                        <h2 id="docs-page-setup-title" className={styles.title}>
                            Page setup
                        </h2>
                        <p className={styles.copy}>
                            Adjust page margins once and keep the editor canvas, ruler geometry, PDF output, and DOCX export aligned.
                        </p>
                    </div>
                    <div className={styles.headerMeta}>
                        <div className={styles.heroCard}>
                            <span className={styles.heroLabel}>Current layout</span>
                            <strong>A4 portrait</strong>
                            <span>
                                {activePreset ? `${activePreset} preset` : 'Custom margins'}
                            </span>
                        </div>
                        <Button variant="ghost" onClick={onClose} disabled={saving}>
                            Close
                        </Button>
                    </div>
                </div>

                <div className={styles.body}>
                    <div className={styles.controls}>
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionLabel}>Presets</span>
                                <p className={styles.sectionCopy}>
                                    Start with a balanced preset, then fine-tune individual sides only if needed.
                                </p>
                            </div>
                            <div className={styles.presetRow}>
                                {PRESETS.map((preset) => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        className={`${styles.preset}${
                                            activePreset === preset.label ? ` ${styles.presetActive}` : ''
                                        }`}
                                        onClick={() => applyPreset(preset.inches)}
                                        disabled={saving}
                                    >
                                        <span className={styles.presetBadge}>
                                            {activePreset === preset.label ? 'Active' : 'Preset'}
                                        </span>
                                        <strong>{preset.label}</strong>
                                        <span>{preset.inches.toFixed(2)} in on all sides</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionLabel}>Margins</span>
                                <p className={styles.sectionCopy}>
                                    Use inches for predictable print output. Changes are reflected live in the preview.
                                </p>
                            </div>
                            <div className={styles.grid}>
                                {(['top', 'right', 'bottom', 'left'] as MarginField[]).map((field) => (
                                    <label key={field} className={styles.field}>
                                        <span>{field.charAt(0).toUpperCase() + field.slice(1)} margin</span>
                                        <div className={styles.fieldInput}>
                                            <input
                                                type="number"
                                                min={0.5}
                                                max={2}
                                                step={0.05}
                                                value={margins[field]}
                                                onChange={(event) => handleMarginChange(field, event.target.value)}
                                                disabled={saving}
                                            />
                                            <small>in</small>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <div className={styles.summaryGrid}>
                                <div className={styles.summaryCard}>
                                    <span>Printable width</span>
                                    <strong>{printableWidth.toFixed(2)} in</strong>
                                </div>
                                <div className={styles.summaryCard}>
                                    <span>Printable height</span>
                                    <strong>{printableHeight.toFixed(2)} in</strong>
                                </div>
                                <div className={styles.summaryCard}>
                                    <span>Paper size</span>
                                    <strong>A4 portrait</strong>
                                </div>
                            </div>
                        </div>

                        <DocumentHeaderFooterControls
                            value={headerFooter}
                            saving={saving}
                            onChange={setHeaderFooter}
                        />
                    </div>

                    <div className={styles.previewWrap}>
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionLabel}>Preview</span>
                            <p className={styles.sectionCopy}>
                                The shaded frame represents the writable area available to the editor and export pipeline.
                            </p>
                        </div>
                        <div className={styles.preview}>
                            <div className={styles.previewStats}>
                                <div className={styles.previewStat}>
                                    <span>Top</span>
                                    <strong>{parsedMargins.top.toFixed(2)} in</strong>
                                </div>
                                <div className={styles.previewStat}>
                                    <span>Right</span>
                                    <strong>{parsedMargins.right.toFixed(2)} in</strong>
                                </div>
                                <div className={styles.previewStat}>
                                    <span>Bottom</span>
                                    <strong>{parsedMargins.bottom.toFixed(2)} in</strong>
                                </div>
                                <div className={styles.previewStat}>
                                    <span>Left</span>
                                    <strong>{parsedMargins.left.toFixed(2)} in</strong>
                                </div>
                            </div>
                            <div className={styles.previewSheet}>
                                <div className={styles.previewHeader} />
                                <div className={styles.previewSafe} style={previewStyle}>
                                    <span />
                                    <span />
                                    <span />
                                    <span />
                                    <div className={styles.previewContent}>
                                        <div />
                                        <div />
                                        <div />
                                    </div>
                                </div>
                            </div>
                            <p className={styles.previewNote}>
                                Printable area updates instantly as you change the numbers.
                            </p>
                        </div>
                    </div>
                </div>

                <div className={styles.footer}>
                    <p className={styles.footnote}>
                        Allowed range: 0.50 in to 2.00 in per side.
                    </p>
                    <div className={styles.actions}>
                        <Button variant="ghost" onClick={onClose} disabled={saving}>
                            Cancel
                        </Button>
                        <Button
                            onClick={submit}
                            disabled={saving || !hasChanges}
                            loading={saving}
                            loadingText="Saving…"
                        >
                            Save page setup
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
