'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProjectModal from '@/components/chat/project-modal';
import { useQuery } from '@apollo/client';
import { GET_USER_PROJECTS } from '@/graphql/request';
import { useAuthContext } from '@/providers/AuthProvider';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthorized } = useAuthContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { refetch } = useQuery(GET_USER_PROJECTS, {
    skip: !isAuthorized,
  });
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
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        refetchProjects={refetch}
      />
      <div className="w-full h-full">{children}</div>
    </main>
  );
}
