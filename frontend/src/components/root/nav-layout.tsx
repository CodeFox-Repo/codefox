'use client';
import React, { useRef } from 'react';
import Image from 'next/image';
import { useAuthContext } from '@/providers/AuthProvider';
import FloatingNavbar, { NavbarRef } from './nav';

interface NavLayoutProps {
  children: React.ReactNode;
}

export default function NavLayout({ children }: NavLayoutProps) {
  const navRef = useRef<NavbarRef>(null);
  const { isAuthorized } = useAuthContext();

  const logoElement = !isAuthorized ? (
    <Image src="/codefox.svg" alt="CodeFox Logo" width={64} height={64} />
  ) : null;

  return (
    <>
      <FloatingNavbar
        ref={navRef}
        logo={logoElement}
        name={!isAuthorized ? 'CodeFox' : ''}
        className="transition-transform duration-300"
      />
      <div className="w-full">{children}</div>
    </>
  );
}
