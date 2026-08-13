/**
 * SignatureStripCard
 *
 * A draggable digital-notary certification block placed on locked documents.
 * Renders the signature image, a QR verification code, and — when editable —
 * placement controls for repositioning and saving the block on the paper.
 *
 * Design language: official document seal — clean, document-appropriate,
 * distinct from the glassmorphism app shell.
 */
import type { PointerEventHandler } from 'react';
import type { DocumentCompletedSignature } from '@/api/documents.api';
import { Button } from '@/components/ui';

interface SignatureStripCardProps {
    documentTitle: string;
    signatureImageUrl: string | null;
    completedSignatures: DocumentCompletedSignature[];
    qrCodeUrl: string | null;
    canAdjustPlacement: boolean;
    dragging: boolean;
    dirty: boolean;
    persisting: boolean;
    onPointerDown: PointerEventHandler<HTMLDivElement>;
    onReset: () => void;
    onSave: () => void;
}

function formatSignedAt(value: string): string {
    return new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/** Drag-handle icon for the placement hint row. */
function DragIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="9" cy="7"  r="1.5" fill="#999" />
            <circle cx="15" cy="7"  r="1.5" fill="#999" />
            <circle cx="9" cy="12" r="1.5" fill="#999" />
            <circle cx="15" cy="12" r="1.5" fill="#999" />
            <circle cx="9" cy="17" r="1.5" fill="#999" />
            <circle cx="15" cy="17" r="1.5" fill="#999" />
        </svg>
    );
}

/** Renders the full-width status pill shown above the card when placement is active. */
function PlacementHint({
    dirty,
    dragging,
    persisting,
}: {
    dirty: boolean;
    dragging: boolean;
    persisting: boolean;
}) {
    const label = persisting ? 'Saving…' : dragging ? 'Moving' : dirty ? 'Unsaved changes' : 'Position saved';
    const labelColor = persisting
        ? '#6b7280'
        : dragging
            ? 'var(--color-primary)'
            : dirty
                ? '#b45309'
                : '#15803d';

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '5px 10px',
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.18)',
            borderLeft: '3px solid var(--color-primary)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            fontSize: 11,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DragIcon />
                <span style={{ color: '#444', fontWeight: 500 }}>Drag to reposition</span>
            </div>
            <span style={{ fontWeight: 600, color: labelColor }}>{label}</span>
        </div>
    );
}

/** The main certification card — signature image, header seal, QR code, and verify text. */
export function SignatureStripCard({
    documentTitle,
    signatureImageUrl,
    completedSignatures,
    qrCodeUrl,
    canAdjustPlacement,
    dragging,
    dirty,
    persisting,
    onPointerDown,
    onReset,
    onSave,
}: SignatureStripCardProps) {
    return (
        <div style={{ display: 'grid', gap: 6, width: 360 }}>

            {/* ── Placement hint pill ── */}
            {canAdjustPlacement && (
                <PlacementHint dirty={dirty} dragging={dragging} persisting={persisting} />
            )}

            {/* ── Main card ── */}
            <div
                onPointerDown={onPointerDown}
                style={{
                    background: '#ffffff',
                    border: `1px solid ${dragging ? 'rgba(91,35,255,0.35)' : 'rgba(0,0,0,0.18)'}`,
                    borderLeft: `4px solid ${dragging ? 'var(--color-primary)' : '#15803d'}`,
                    boxShadow: dragging
                        ? '0 16px 36px rgba(91,35,255,0.14), 0 4px 12px rgba(0,0,0,0.12)'
                        : '0 2px 8px rgba(0,0,0,0.12)',
                    cursor: canAdjustPlacement ? (dragging ? 'grabbing' : 'grab') : 'default',
                    userSelect: 'none',
                    touchAction: canAdjustPlacement ? 'none' : 'auto',
                    opacity: persisting ? 0.75 : 1,
                    transition: dragging ? 'none' : 'box-shadow 160ms ease, border-color 160ms ease',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >

                {/* Signature display area */}
                <div style={{
                    padding: '18px 16px 14px',
                    minHeight: 94,
                    display: 'grid',
                    gap: 12,
                    borderBottom: '1px solid rgba(0,0,0,0.07)',
                    position: 'relative',
                    background: '#fafafa',
                }}>
                    {/* Signature line underlay */}
                    <div style={{
                        position: 'absolute',
                        bottom: 22,
                        left: 16,
                        right: 16,
                        height: 1,
                        background: 'rgba(0,0,0,0.1)',
                    }} />

                    {signatureImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={signatureImageUrl}
                            alt={`${documentTitle} signature`}
                            style={{ maxWidth: '100%', maxHeight: 56, objectFit: 'contain', position: 'relative', zIndex: 1 }}
                            draggable={false}
                        />
                    ) : (
                        <span style={{
                            fontFamily: 'Georgia, "Times New Roman", serif',
                            fontSize: 18,
                            fontStyle: 'italic',
                            color: 'var(--color-primary)',
                            letterSpacing: '0.02em',
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            Digitally signed
                        </span>
                    )}

                    {completedSignatures.length > 0 ? (
                        <div style={{
                            position: 'relative',
                            zIndex: 1,
                            display: 'grid',
                            gap: 8,
                        }}>
                            {completedSignatures.map((signature) => (
                                <div
                                    key={signature.signatureId}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: signature.imageUrl ? 'minmax(0, 1fr) auto' : '1fr',
                                        gap: 10,
                                        alignItems: 'end',
                                        paddingTop: 8,
                                        borderTop: '1px dashed rgba(22,16,58,0.12)',
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            flexWrap: 'wrap',
                                            marginBottom: 3,
                                        }}>
                                            <span style={{
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: '#16103a',
                                                lineHeight: 1.25,
                                            }}>
                                                {signature.signerName}
                                            </span>
                                            {signature.isOwner ? (
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: 999,
                                                    background: 'rgba(91,35,255,0.08)',
                                                    color: 'var(--color-primary)',
                                                    fontSize: 9,
                                                    fontWeight: 800,
                                                    letterSpacing: '0.08em',
                                                    textTransform: 'uppercase',
                                                }}>
                                                    Owner
                                                </span>
                                            ) : null}
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            flexWrap: 'wrap',
                                            color: '#6b7280',
                                            fontSize: 10.5,
                                            lineHeight: 1.45,
                                        }}>
                                            <span>{signature.signerEmail}</span>
                                            <span>Signed {formatSignedAt(signature.signedAt)}</span>
                                        </div>
                                    </div>

                                    {signature.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={signature.imageUrl}
                                            alt={`${signature.signerName} signature`}
                                            style={{
                                                maxWidth: 124,
                                                maxHeight: 40,
                                                objectFit: 'contain',
                                            }}
                                            draggable={false}
                                        />
                                    ) : (
                                        <span style={{
                                            fontFamily: 'Georgia, \"Times New Roman\", serif',
                                            fontSize: 15,
                                            fontStyle: 'italic',
                                            color: '#374151',
                                            justifySelf: 'end',
                                        }}>
                                            Digitally signed
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>

                {/* Bottom row: QR code + verification info */}
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    {/* QR code column */}
                    <div style={{
                        flexShrink: 0,
                        width: 90,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px 8px',
                        borderRight: '1px solid rgba(0,0,0,0.07)',
                        background: '#f8f8f8',
                    }}>
                        {qrCodeUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={qrCodeUrl}
                                alt={`QR code to verify ${documentTitle}`}
                                width={70}
                                height={70}
                                draggable={false}
                            />
                        ) : (
                            <div style={{
                                width: 70,
                                height: 70,
                                background: '#ececec',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 9,
                                color: '#aaa',
                                textAlign: 'center',
                                lineHeight: 1.5,
                            }}>
                                QR<br />CODE
                            </div>
                        )}
                    </div>

                    {/* Verification info column */}
                    <div style={{
                        flex: 1,
                        padding: '10px 12px',
                        display: 'grid',
                        gap: 4,
                        alignContent: 'center',
                    }}>
                        <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: '#888',
                        }}>
                            Scan to verify
                        </span>
                        <span style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#222',
                            lineHeight: 1.3,
                            wordBreak: 'break-word',
                        }}>
                            {documentTitle}
                        </span>
                        <span style={{
                            fontSize: 10,
                            color: '#888',
                            lineHeight: 1.5,
                        }}>
                            Scan the QR code to confirm this document is authentic and unmodified.
                        </span>
                    </div>
                </div>

                {/* Placement action controls */}
                {canAdjustPlacement && (
                    <div
                        data-signature-action="true"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            padding: '8px 12px',
                            borderTop: '1px solid rgba(0,0,0,0.08)',
                            background: '#f9f9f9',
                        }}
                    >
                        <span style={{
                            fontSize: 10,
                            color: '#999',
                            lineHeight: 1.4,
                            maxWidth: 150,
                        }}>
                            Position it precisely, then save.
                        </span>
                        <div data-signature-action="true" style={{ display: 'flex', gap: 6 }}>
                            <Button
                                type="button"
                                data-signature-action="true"
                                onClick={onReset}
                                disabled={persisting || !dirty}
                                variant="ghost"
                                size="sm"
                            >
                                Reset
                            </Button>
                            <Button
                                type="button"
                                data-signature-action="true"
                                onClick={onSave}
                                disabled={persisting || !dirty}
                                size="sm"
                            >
                                {persisting ? 'Saving…' : 'Save Position'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
