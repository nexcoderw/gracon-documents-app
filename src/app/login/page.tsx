/** Private documents-workspace sign-in route. */
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/pages/auth/login';
import styles from './LoginPage.module.css';

export const metadata: Metadata = {
    title: 'Sign In',
    description: 'Sign in to access your documents workspace.',
    robots: { index: false, follow: false, nocache: true },
};

/** Renders the calm, responsive documents sign-in surface. */
export default function LoginPage() {
    return (
        <div className={styles.page}>
            <div className={styles.content}>
                <div className={styles.brand}>
                    <div className={styles.brandRow}>
                        <div className={styles.brandMark}>G</div>
                        <span className={styles.brandName}>Gracon 360</span>
                    </div>
                    <p className={styles.workspace}>Documents Workspace</p>
                </div>

                <Suspense>
                    <LoginForm />
                </Suspense>
            </div>
        </div>
    );
}
