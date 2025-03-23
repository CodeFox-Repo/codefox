'use client';
import React, { useState, useEffect } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarWrapper } from '@/components/sidebar';
import { useAuthContext } from '@/providers/AuthProvider';

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const { isAuthorized } = useAuthContext();
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    setShowSidebar(isAuthorized);
  }, [isAuthorized]);

  return (
    <SidebarProvider defaultOpen={false}>
      {showSidebar ? (
        <SidebarWrapper isAuthorized={isAuthorized}>{children}</SidebarWrapper>
      ) : (
        <div className="min-h-screen flex">
          <div className="w-full">{children}</div>
        </div>
      )}
    </SidebarProvider>
  );
}
