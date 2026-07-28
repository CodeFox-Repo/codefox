'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { useChatList } from '@/hooks/useChatList';

interface ChatTopbarProps {
  chatId?: string;
}

/**
 * Header for the chat column: the way back to your projects, and which
 * conversation you are in. With the sidebar gone, the back arrow is the
 * navigation — home is the project list.
 */
export default function ChatTopbar({ chatId }: ChatTopbarProps) {
  const router = useRouter();
  const { chats } = useChatList();

  const title = chatId
    ? chats.find((c) => c.id === chatId)?.title || 'Untitled'
    : 'New Chat';

  return (
    <div className="flex w-full items-center gap-2 border-b border-border bg-background px-3 py-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 shrink-0 p-0"
        onClick={() => router.push('/')}
        title="Back to projects"
        aria-label="Back to projects"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <h1 className="truncate font-medium text-sm text-foreground">{title}</h1>
    </div>
  );
}
