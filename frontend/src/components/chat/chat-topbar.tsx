'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { useChatList } from '@/hooks/useChatList';

interface ChatTopbarProps {
  chatId?: string;
}

/**
 * Header for the chat column: which conversation you are in, and a way out to
 * a new one. The chat *list* lives in the sidebar — this bar deliberately does
 * not duplicate it.
 */
export default function ChatTopbar({ chatId }: ChatTopbarProps) {
  const router = useRouter();
  const { chats } = useChatList();

  const title = chatId
    ? chats.find((c) => c.id === chatId)?.title || 'Untitled'
    : 'New Chat';

  return (
    <div className="flex w-full items-center justify-between border-b border-border bg-background px-4 py-2">
      <h1 className="truncate font-medium text-sm text-foreground">{title}</h1>

      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 shrink-0 p-0"
        onClick={() => router.push('/')}
        title="New chat"
        aria-label="New chat"
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
