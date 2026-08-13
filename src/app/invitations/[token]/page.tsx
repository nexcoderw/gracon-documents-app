/** Private token-gated document invitation route. */
import type { Metadata } from 'next';
import { InvitationAcceptanceView } from '@/components/pages/invitations/InvitationAcceptanceView';

export const metadata: Metadata = {
    title: 'Document Invitation',
    description: 'Review and accept a secure document-sharing invitation.',
    robots: { index: false, follow: false, nocache: true },
};

type Props = {
    params: Promise<{
        token: string;
    }>;
};

/** Renders the invitation gate without exposing its token through metadata. */
export default async function InvitationPage({ params }: Props) {
    const { token } = await params;

    return <InvitationAcceptanceView token={token} />;
}
