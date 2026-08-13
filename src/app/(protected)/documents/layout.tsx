/** Private metadata boundary for document workspace routes. */
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Documents',
    description: 'Find, organize, create, and manage documents in your private workspace.',
    robots: { index: false, follow: false, nocache: true },
};

/** Preserves document routes while supplying private metadata. */
export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
