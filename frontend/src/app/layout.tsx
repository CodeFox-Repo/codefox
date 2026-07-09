// frontend/src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { BaseProviders } from '@/providers/BaseProvider';
import NavLayout from '@/components/root/nav-layout';
import RootLayout from '@/components/root/root-layout';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
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
      <body className={`${inter.variable} ${playfair.variable}  font-sans`}>
        <BaseProviders>
          <div className="min-h-screen w-full bg-gray-50 dark:bg-gray-900 transition-colors">
            <RootLayout>
              {children}
              <Toaster />
            </RootLayout>
          </div>
        </BaseProviders>
      </body>
    </html>
  );
}
