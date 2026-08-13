/** Private metadata boundary for document templates. */
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Templates',
    description: 'Choose an approved starting point for a new Gracon document.',
    robots: { index: false, follow: false, nocache: true },
};

/** Preserves template routes while supplying private metadata. */
export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
