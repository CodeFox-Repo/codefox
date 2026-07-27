'use client';
import React, { useRef } from 'react';
import { useAuthContext } from '@/providers/AuthProvider';
import FloatingNavbar, { NavbarRef } from './nav';

interface NavLayoutProps {
  children: React.ReactNode;
}

export default function NavLayout({ children }: NavLayoutProps) {
  const navRef = useRef<NavbarRef>(null);
  const { isAuthorized } = useAuthContext();

  const logoElement = null;

  return (
    <>
      <FloatingNavbar
        ref={navRef}
        logo={logoElement}
        name="CodeFox"
        className="transition-transform duration-300"
      />
      <div className="w-full">{children}</div>
    </>
  );
}
