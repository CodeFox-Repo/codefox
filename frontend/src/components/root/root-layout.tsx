'use client';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarWrapper } from '@/components/sidebar';
import { useAuthContext } from '@/providers/AuthProvider';

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const { isAuthorized } = useAuthContext();
  const pathname = usePathname();
  const [showSidebar, setShowSidebar] = useState(false);

  // The operator console is not part of the personal workspace — the chats
  // sidebar there is someone's private project list on an admin screen.
  const isAdminPage = pathname?.startsWith('/admin');

  useEffect(() => {
    setShowSidebar(isAuthorized);
  }, [isAuthorized]);

  return (
    <SidebarProvider defaultOpen={false}>
      {showSidebar && !isAdminPage ? (
        <SidebarWrapper isAuthorized={isAuthorized}>{children}</SidebarWrapper>
      ) : (
        <div className="min-h-screen flex">
          <div className="w-full">{children}</div>
        </div>
      )}
    </SidebarProvider>
  );
}
