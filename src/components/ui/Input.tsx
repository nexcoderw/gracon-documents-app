/** Shared labelled input for document-app forms and searches. */
'use client';

import { InputHTMLAttributes, forwardRef, ReactNode, useId, useState } from 'react';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    showPasswordToggle?: boolean;
}

/** Renders a labelled input with accessible hint, error, and password controls. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            error,
            hint,
            leftIcon,
            rightIcon,
            showPasswordToggle = false,
            type = 'text',
            id,
            className = '',
            ...rest
        },
        ref,
    ) => {
        const [showPassword, setShowPassword] = useState(false);
        const generatedId = useId();
        const inputId = id ?? generatedId;

        const resolvedType = showPasswordToggle
            ? showPassword
                ? 'text'
                : 'password'
            : type;

        return (
            <div className={styles.field}>
                {label && (
                    <label htmlFor={inputId} className={styles.label}>
                        {label}
                        {rest.required && (
                            <span aria-hidden="true" className={styles.required}>
                                *
                            </span>
                        )}
                    </label>
                )}

                <div className={styles.control}>
                    {leftIcon && (
                        <span aria-hidden="true" className={`${styles.icon} ${styles.leftIcon}`}>
                            {leftIcon}
                        </span>
                    )}

                    <input
                        ref={ref}
                        id={inputId}
                        type={resolvedType}
                        className={[
                            styles.input,
                            leftIcon ? styles.withLeftIcon : '',
                            rightIcon || showPasswordToggle ? styles.withRightIcon : '',
                            error ? styles.errorInput : '',
                            className,
                        ].filter(Boolean).join(' ')}
                        aria-invalid={!!error}
                        aria-describedby={
                            error
                                ? `${inputId}-error`
                                : hint
                                  ? `${inputId}-hint`
                                  : undefined
                        }
                        {...rest}
                    />

                    {showPasswordToggle ? (
                        <button
                            type="button"
                            className={styles.passwordToggle}
                            onClick={() => setShowPassword((previous) => !previous)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            aria-pressed={showPassword}
                        >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    {showPassword ? (
                                        <>
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </>
                                    ) : (
                                        <>
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </>
                                    )}
                                </svg>
                        </button>
                    ) : rightIcon ? (
                        <span aria-hidden="true" className={`${styles.icon} ${styles.rightIcon}`}>
                            {rightIcon}
                        </span>
                    ) : null}
                </div>

                {error && (
                    <p id={`${inputId}-error`} role="alert" className={`${styles.message} ${styles.error}`}>
                        {error}
                    </p>
                )}

                {hint && !error && (
                    <p id={`${inputId}-hint`} className={`${styles.message} ${styles.hint}`}>
                        {hint}
                    </p>
                )}
            </div>
        );
    },
);

Input.displayName = 'Input';
