/** Shared non-printable card surface for document application chrome. */
import { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children?: ReactNode;
    strength?: 'default' | 'strong';
    padding?: 'sm' | 'md' | 'lg' | 'none';
}

/** Renders frosted application chrome without affecting printable paper. */
export function Card({
    children,
    strength = 'default',
    padding = 'md',
    className = '',
    ...rest
}: CardProps) {
    return (
        <div
            className={`${styles.card} ${styles[strength]} ${styles[padding]} ${className}`}
            {...rest}
        >
            {children}
        </div>
    );
}
