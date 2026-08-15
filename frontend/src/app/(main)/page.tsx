'use client';

import { useRef, useContext } from 'react';
import { useAuthContext } from '@/providers/AuthProvider';
import { PromptFormRef } from '@/components/root/prompt-form';
import { ProjectContext } from '@/components/chat/code-engine/project-context';
import { Landing } from '@/components/root/landing';
import { Workbench } from '@/components/root/workbench';
import { useRouter } from 'next/navigation';
import { logger } from '../log/logger';

export default function HomePage() {
  const router = useRouter();
  const promptFormRef = useRef<PromptFormRef>(null);
  const { isAuthorized } = useAuthContext();
  const { createProjectFromPrompt, isLoading } = useContext(ProjectContext);

  const handleSubmit = async () => {
    if (!promptFormRef.current) return;

    const { message, isPublic, model, scenario, style } =
      promptFormRef.current.getPromptData();
    if (!message.trim()) return;

    try {
      const chatId = await createProjectFromPrompt(
        message,
        isPublic,
        model,
        scenario,
        style
      );
      if (!chatId) return; // createProjectFromPrompt already surfaced the error

      promptFormRef.current.clearMessage();
      router.push(`/chat?id=${chatId}`);
    } catch (error) {
      logger.error('Error creating project:', error);
    }
  };

  // Signed in? Skip the pitch — go straight to the composer and your work.
  if (isAuthorized) {
    return (
      <Workbench
        promptFormRef={promptFormRef}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    );
  }

  return <Landing />;
}
