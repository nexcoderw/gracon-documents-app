/**
 * Redirects the app root to the protected documents index.
 */
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Documents Workspace',
    description: 'Open the private Gracon documents workspace.',
    robots: { index: false, follow: false, nocache: true },
};

export default function RootPage() {
    redirect('/documents');
}
