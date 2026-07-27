// frontend/src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { BaseProviders } from '@/providers/BaseProvider';
import NavLayout from '@/components/root/nav-layout';
import RootLayout from '@/components/root/root-layout';

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'Codefox - The best dev project generator',
  description: 'The best dev project generator',
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
          </div>
        </BaseProviders>
      </body>
    </html>
  );
}
