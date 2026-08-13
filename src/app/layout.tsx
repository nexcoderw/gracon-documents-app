/** Root document-app shell, global metadata defaults, typography, and feedback host. */
import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import { AppToaster } from '@/components/ui';
import './globals.css';

const dmSans = DM_Sans({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
    variable: '--font-dm-sans',
    display: 'swap',
});

export const metadata: Metadata = {
    metadataBase: new URL(
        process.env.NEXT_PUBLIC_DOCS_URL ?? 'http://localhost:4002',
    ),
    applicationName: 'Gracon 360 Documents',
    title: {
        default: 'Documents | Gracon 360',
        template: '%s | Gracon 360',
    },
    description:
        'Create, collaborate on, verify, sign, and manage trusted documents in Gracon 360.',
};

/** Renders the shared HTML shell for every documents route. */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={dmSans.variable}>
            <body className="font-sans antialiased" suppressHydrationWarning>
                <AppToaster />
                {children}
            </body>
        </html>
    );
}
