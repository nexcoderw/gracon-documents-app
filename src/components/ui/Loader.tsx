/** Shared document-app loading indicator. */
'use client';

import type { CSSProperties } from 'react';
import styles from './Loader.module.css';

export interface PremiumLoaderProps {
    size?: number;
    color?: 'primary' | 'white';
}

/**
 * Renders the unified document-app loading indicator.
 */
export function PremiumLoader({
    size = 18,
    color = 'white',
}: PremiumLoaderProps) {
    const thickness = Math.max(2.5, size * 0.14);
    const loaderStyle = {
        '--loader-size': `${size}px`,
        '--loader-thickness': `${thickness}px`,
    } as CSSProperties;

    return (
        <span
            aria-hidden="true"
            className={`${styles.loader} ${styles[color]}`}
            style={loaderStyle}
        />
    );
}
