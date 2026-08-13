/** Private metadata for the document editor. */
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Edit Document',
    description: 'Edit and review one authorized document without exposing its title or identifier.',
};

/** Preserves the editor route while supplying identifier-safe metadata. */
export default function EditDocumentLayout({ children }: { children: React.ReactNode }) {
    return children;
}
