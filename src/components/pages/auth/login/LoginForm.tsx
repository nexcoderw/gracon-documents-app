'use client';

/**
 * Login form for the documents workspace.
 *
 * Successful sign-in performs a full navigation to the documents index so the
 * protected shell rehydrates against the freshly written session cookies.
 * If a ?next path is present, the user is returned there after sign-in.
 */
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';
import { loginApi } from '@/api/auth/login.api';
import { APP_URL, DOCS_URL, normalizeDocsPath } from '@/lib/session';
import styles from './LoginForm.module.css';

interface LoginErrors {
    email?: string;
    password?: string;
}

export function LoginForm() {
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<LoginErrors>({});
    const [apiError, setApiError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const nextPath = normalizeDocsPath(searchParams.get('next'));
    const isInvitationReturn = nextPath.startsWith('/invitations/');

    function validate(): boolean {
        const nextErrors: LoginErrors = {};
        const normalizedEmail = email.toLowerCase().trim();

        if (!normalizedEmail) {
            nextErrors.email = 'Please enter a valid email address';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            nextErrors.email = 'Please enter a valid email address';
        }

        if (!password) {
            nextErrors.password = 'Password is required';
        } else if (password.length > 128) {
            nextErrors.password = 'Password is too long';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setApiError(null);

        if (!validate()) {
            return;
        }

        setLoading(true);

        try {
            const response = await loginApi({
                email: email.toLowerCase().trim(),
                password,
            });

            if (response.data.tokenType === 'limited' && !isInvitationReturn) {
                const returnUrl = `${DOCS_URL}${nextPath}`;
                window.location.href = `${APP_URL}/verify-identity?next=${encodeURIComponent(returnUrl)}`;
                return;
            }

            window.location.href = nextPath;
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ??
                'Login failed. Please check your credentials.';

            setApiError(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card strength="strong" className={styles.card}>
            <div className={styles.content}>
                <div className={styles.header}>
                    <div className={styles.identityMark}>ID</div>

                    <h1 className={styles.title}>Welcome back</h1>
                    <p className={styles.subtitle}>
                        Sign in to your verified account
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className={styles.form}
                    noValidate
                >
                    <Input
                        label="Email address"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => {
                            setEmail(event.target.value);
                            if (errors.email) {
                                setErrors((previous) => ({
                                    ...previous,
                                    email: undefined,
                                }));
                            }
                        }}
                        error={errors.email}
                    />

                    <Input
                        label="Password"
                        showPasswordToggle
                        placeholder="Your password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(event) => {
                            setPassword(event.target.value);
                            if (errors.password) {
                                setErrors((previous) => ({
                                    ...previous,
                                    password: undefined,
                                }));
                            }
                        }}
                        error={errors.password}
                    />

                    {apiError && (
                        <div role="alert" className={styles.error}>
                            {apiError}
                        </div>
                    )}

                    <div className={styles.forgotRow}>
                        <a
                            href={`${APP_URL}/forgot-password`}
                            className={`${styles.link} ${styles.mutedLink}`}
                        >
                            Forgot password?
                        </a>
                    </div>

                    <Button
                        type="submit"
                        fullWidth
                        loading={loading}
                        loadingText="Signing in..."
                        className={styles.submit}
                    >
                        Sign in
                    </Button>
                </form>

                <p className={styles.registration}>
                    Don&apos;t have an account?{' '}
                    <a href={`${APP_URL}/register`} className={styles.link}>
                        Create one
                    </a>
                </p>
            </div>
        </Card>
    );
}
