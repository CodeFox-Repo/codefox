'use client';
import React from 'react';
import FloatingNavbar from './nav';

interface NavLayoutProps {
  children: React.ReactNode;
}

export default function NavLayout({ children }: NavLayoutProps) {
  return (
    <>
      <FloatingNavbar
        name="CodeFox"
        className="transition-transform duration-300"
      />
      <div className="w-full">{children}</div>
    </>
  );
}
