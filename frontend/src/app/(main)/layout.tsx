import type { Viewport } from 'next';
import NavLayout from '@/components/root/nav-layout';

// No metadata here: the root layout owns title, description and the og /
// twitter card. This duplicated the placeholder pair and, being nested, won
// — so the real ones never reached the page.

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <NavLayout>{children}</NavLayout>;
}
