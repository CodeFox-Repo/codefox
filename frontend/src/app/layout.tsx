// frontend/src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { siteUrl } from '@/lib/site';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { BaseProviders } from '@/providers/BaseProvider';
import RootLayout from '@/components/root/root-layout';
import { DevAuthToggle } from '@/components/dev/auth-toggle';

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});

const DESCRIPTION =
  'Describe a page and CodeFox builds it — real files, a live preview, and a ' +
  'link you can send. Landing pages, dashboards, decks and docs, from one prompt.';

export const metadata: Metadata = {
  // metadataBase makes the relative og:image below absolute, which crawlers
  // require; without it Next warns and emits a relative url nobody can fetch.
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'CodeFox — describe a page, get a real one',
    // Every other route is signed-in, so this only shows if one adds a title.
    template: '%s — CodeFox',
  },
  description: DESCRIPTION,
  applicationName: 'CodeFox',
  // The landing page IS the gallery, so one canonical covers both.
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'CodeFox',
    title: 'CodeFox — describe a page, get a real one',
    description: DESCRIPTION,
    url: '/',
    images: ['/icon.png'],
  },
  twitter: {
    card: 'summary',
    title: 'CodeFox — describe a page, get a real one',
    description: DESCRIPTION,
    images: ['/icon.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${grotesk.variable} ${jetbrains.variable} font-sans`}>
        <BaseProviders>
          <div className="min-h-screen w-full bg-background transition-colors">
            <RootLayout>{children}</RootLayout>
            <DevAuthToggle />
          </div>
        </BaseProviders>
      </body>
    </html>
  );
}
