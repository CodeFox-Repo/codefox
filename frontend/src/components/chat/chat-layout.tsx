'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthorized } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthorized) {
      router.push('/');
    }
  }, [isAuthorized, router]);

  if (!isAuthorized) {
    return null;
  }

  return (
    <main className="flex h-[calc(100dvh)] flex-col items-center">
      <div className="w-full h-full">{children}</div>
    </main>
  );
}
