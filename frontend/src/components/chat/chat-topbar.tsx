'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Eraser,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  CLEAR_CHAT_HISTORY,
  DELETE_CHAT,
  UPDATE_CHAT_TITLE,
} from '@/graphql/request';
import { useChatList } from '@/hooks/useChatList';

interface ChatTopbarProps {
  chatId?: string;
  /** Lets the page drop its local messages after a server-side clear. */
  onHistoryCleared?: () => void;
}

/**
 * Header for the chat column: the way back to your projects, the title, and
 * the chat's own management. With the sidebar gone this bar is where rename,
 * clear and delete live.
 */
export default function ChatTopbar({
  chatId,
  onHistoryCleared,
}: ChatTopbarProps) {
  const router = useRouter();
  const { chats, refetchChats } = useChatList();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const title = chatId
    ? chats.find((c) => c.id === chatId)?.title || 'Untitled'
    : 'New Chat';

  // The browser tab should say which project this is, not just "Codefox" —
  // with several projects open, identical tabs are unfindable.
  useEffect(() => {
    document.title = `${title} — CodeFox`;
    return () => {
      document.title = 'CodeFox';
    };
  }, [title]);

  const [updateTitle] = useMutation(UPDATE_CHAT_TITLE, {
    onCompleted: () => refetchChats(),
    onError: () => toast.error('Could not rename the chat'),
  });
  const [clearHistory] = useMutation(CLEAR_CHAT_HISTORY, {
    onCompleted: () => {
      onHistoryCleared?.();
      toast.success('History cleared');
    },
    onError: () => toast.error('Could not clear the history'),
  });
  const [deleteChat] = useMutation(DELETE_CHAT, {
    onCompleted: () => {
      toast.success('Chat deleted');
      router.push('/');
    },
    onError: () => toast.error('Could not delete the chat'),
  });

  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (!next || next === title || !chatId) return;
    updateTitle({ variables: { input: { chatId, title: next } } });
  };

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

      {renaming ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setRenaming(false);
          }}
          aria-label="Chat title"
          className="h-8 min-w-0 flex-1 rounded bg-background px-2 text-sm text-foreground outline-none ring-1 ring-ring"
        />
      ) : (
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {title}
        </h1>
      )}

      {chatId && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Chat options"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setDraft(title);
                // Same Radix race as the old sidebar: let the menu close first.
                setTimeout(() => setRenaming(true), 0);
              }}
            >
              <Pencil className="mr-2 h-4 w-4 shrink-0" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => clearHistory({ variables: { chatId } })}
            >
              <Eraser className="mr-2 h-4 w-4 shrink-0" />
              Clear history
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setTimeout(() => setConfirmDelete(true), 0)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4 shrink-0" />
              Delete chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader className="space-y-4">
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>
              “{title}” and its history will be removed. The generated project
              files stay on disk.
            </DialogDescription>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmDelete(false);
                  if (chatId) deleteChat({ variables: { chatId } });
                }}
              >
                Delete
              </Button>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
