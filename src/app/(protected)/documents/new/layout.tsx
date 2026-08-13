/** Private metadata for document creation. */
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'New Document',
    description: 'Create a new document or begin from an approved template.',
};

/** Preserves the document creation route while supplying safe metadata. */
export default function NewDocumentLayout({ children }: { children: React.ReactNode }) {
    return children;
}
