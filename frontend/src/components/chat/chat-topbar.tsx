'use client';
import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '../ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { HistoryIcon, ArchiveIcon, PlusIcon, FileTextIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

// Mock data for chat history
const mockChatHistory = [
  {
    id: 'chat-1',
    title: 'still working on this feature',
    date: '2 hours ago',
    isPinned: true,
  },
  {
    id: 'chat-2',
    title: 'Portfolio website design',
    date: 'Yesterday',
    isPinned: false,
  },
];

interface ChatTopbarProps {
  currentChatId?: string;
  onChatSelect?: (chatId: string) => void;
  onNewChat?: () => void;
}

export default function ChatTopbar({
  currentChatId,
  onChatSelect,
  onNewChat,
}: ChatTopbarProps) {
  const [open, setOpen] = useState(false);

  // Get current chat title
  const currentChat = currentChatId
    ? mockChatHistory.find((chat) => chat.id === currentChatId)
    : null;

  return (
    <div className="w-full flex px-4 py-2 items-center justify-between border-b">
      <div className="flex items-center gap-2">
        <FileTextIcon className="h-5 w-5 text-primary" />
        <h1 className="font-medium text-sm">
          {currentChat ? currentChat.title : 'New Chat'}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* History dropdown */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <HistoryIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">History</span>
              <Badge variant="secondary" className="ml-1 text-xs px-1 py-0 h-4">
                {mockChatHistory.length}
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="end">
            <div className="px-3 py-2 border-b">
              <h4 className="font-medium text-sm">Recent Chats</h4>
              <p className="text-xs text-muted-foreground">
                Your conversation history
              </p>
            </div>
            <ScrollArea className="h-[320px]">
              <div className="flex flex-col">
                {mockChatHistory.map((chat) => (
                  <div key={chat.id}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-start font-normal rounded-none px-3 py-2 h-auto',
                        currentChatId === chat.id && 'bg-accent'
                      )}
                      onClick={() => {
                        if (onChatSelect) onChatSelect(chat.id);
                        setOpen(false);
                      }}
                    >
                      <div className="flex flex-col items-start text-left w-full">
                        <div className="flex items-center w-full gap-2">
                          <span className="truncate flex-1">{chat.title}</span>
                          {chat.isPinned && <span className="text-xs">📌</span>}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {chat.date}
                        </span>
                      </div>
                    </Button>
                    <Separator />
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-2 border-t flex justify-between">
              <Button variant="ghost" size="sm" className="text-xs h-8 px-2">
                <ArchiveIcon className="h-3.5 w-3.5 mr-1" />
                Archived Chats
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 px-2"
                onClick={() => {
                  if (onNewChat) onNewChat();
                  setOpen(false);
                }}
              >
                <PlusIcon className="h-3.5 w-3.5 mr-1" />
                New Chat
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* New chat button */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onNewChat}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
