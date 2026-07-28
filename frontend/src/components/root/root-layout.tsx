'use client';
import React from 'react';

interface RootLayoutProps {
  children: React.ReactNode;
}

/**
 * The sidebar is gone as a concept: home is the project list, a project page
 * is chat + preview with a back button. Nothing left to wrap.
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <div className="min-h-screen flex">
      <div className="w-full">{children}</div>
    </div>
  );
}
