import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import NavLayout from '@/components/root/nav-layout';

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
  return <NavLayout>{children}</NavLayout>;
}
