/** Shared accessible action button for non-printable document chrome. */
'use client';

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { PremiumLoader } from './Loader';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    loadingText?: string;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    fullWidth?: boolean;
    iconOnly?: boolean;
}

/** Renders a consistently styled button with loading and icon states. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            loading = false,
            loadingText,
            leftIcon,
            rightIcon,
            fullWidth = false,
            iconOnly = false,
            children,
            disabled,
            className = '',
            type = 'button',
            ...rest
        },
        ref,
    ) => {
        const isDisabled = disabled || loading;

        return (
            <button
                ref={ref}
                type={type}
                className={[
                    styles.button,
                    styles[variant],
                    styles[size],
                    fullWidth ? styles.fullWidth : '',
                    iconOnly ? styles.iconOnly : '',
                    className,
                ]
                    .filter(Boolean)
                    .join(' ')}
                disabled={isDisabled}
                aria-busy={loading}
                {...rest}
            >
                {!loading && leftIcon && (
                    <span aria-hidden="true" className={styles.icon}>
                        {leftIcon}
                    </span>
                )}

                {loading && (
                    <PremiumLoader
                        size={15}
                        color={variant === 'primary' ? 'white' : 'primary'}
                    />
                )}

                <span className={styles.label}>
                    {loading && loadingText ? loadingText : children}
                </span>

                {!loading && rightIcon && (
                    <span aria-hidden="true" className={styles.icon}>
                        {rightIcon}
                    </span>
                )}
            </button>
        );
    },
);

Button.displayName = 'Button';
