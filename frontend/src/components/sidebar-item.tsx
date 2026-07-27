'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CLEAR_CHAT_HISTORY,
  DELETE_CHAT,
  UPDATE_CHAT_TITLE,
} from '@/graphql/request';
import { cn } from '@/lib/utils';
import { useMutation } from '@apollo/client';
import { Eraser, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EventEnum } from '../const/EventEnum';
import { logger } from '@/app/log/logger';

interface SideBarItemProps {
  id: string;
  currentChatId: string;
  title: string;
  createdAt?: string | number | Date;
  onSelect: (id: string) => void;
  refetchChats: () => void;
}

const relativeTime = (value?: string | number | Date) => {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

/**
 * One row in the chat rail.
 *
 * The row is a container, not a button — the previous version nested the menu
 * button and a dialog inside the row's own <button>, which is invalid markup
 * and needed stopPropagation on every child to stay usable.
 */
function SideBarItemComponent({
  id,
  currentChatId,
  title,
  createdAt,
  onSelect,
  refetchChats,
}: SideBarItemProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const isSelected = currentChatId === id;

  useEffect(() => setDraft(title), [title]);
  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const [updateTitle] = useMutation(UPDATE_CHAT_TITLE, {
    onCompleted: () => refetchChats(),
    onError: (error) => {
      logger.error('Error renaming chat:', error);
      toast.error('Could not rename this chat');
      setDraft(title);
    },
  });

  const [clearHistory] = useMutation(CLEAR_CHAT_HISTORY, {
    onCompleted: () => {
      toast.success('History cleared');
      // The open conversation is now stale — reload it from the server.
      if (isSelected) window.dispatchEvent(new Event(EventEnum.CHAT));
    },
    onError: (error) => {
      logger.error('Error clearing history:', error);
      toast.error('Could not clear this chat');
    },
  });

  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (!next || next === title) {
      setDraft(title);
      return;
    }
    updateTitle({ variables: { input: { chatId: id, title: next } } });
  };

  const [deleteChat] = useMutation(DELETE_CHAT, {
    onCompleted: () => {
      toast.success('Chat deleted');
      if (isSelected) {
        router.push('/');
        window.dispatchEvent(new Event(EventEnum.NEW_CHAT));
      }
      refetchChats();
    },
    onError: (error) => {
      logger.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    },
  });

  const handleDeleteChat = async () => {
    try {
      await deleteChat({ variables: { chatId: id } });
      setIsDialogOpen(false);
    } catch (error) {
      logger.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    }
  };

  return (
    <div
      className={cn(
        'group/row relative flex items-center rounded-md transition-colors',
        isSelected ? 'bg-secondary' : 'hover:bg-accent'
      )}
    >
      {/* Selection is a 2px rule inside the row, not a full-bleed fill. */}
      {isSelected && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 -left-2 w-[2px] rounded-full bg-primary"
        />
      )}

      {renaming ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraft(title);
              setRenaming(false);
            }
          }}
          aria-label="Chat title"
          className="h-[34px] min-w-0 flex-1 rounded bg-background px-2 text-[13px] text-foreground outline-none ring-1 ring-ring"
        />
      ) : (
        <button
          type="button"
          onClick={() => onSelect(id)}
          aria-current={isSelected ? 'page' : undefined}
          title={title || 'New chat'}
          className="flex h-[34px] min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[13px]',
              isSelected
                ? 'font-medium text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {title || 'New chat'}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70 transition-opacity group-hover/row:opacity-0">
            {relativeTime(createdAt)}
          </span>
        </button>
      )}

      {/* Revealed on hover or keyboard focus so it never competes with titles. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Chat options"
            className="absolute right-1 flex h-7 w-7 items-center justify-center rounded opacity-0 transition-opacity hover:bg-background focus-visible:opacity-100 group-hover/row:opacity-100"
          >
            <MoreHorizontal size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil className="mr-2 h-4 w-4 shrink-0" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => clearHistory({ variables: { chatId: id } })}
          >
            <Eraser className="mr-2 h-4 w-4 shrink-0" />
            Clear history
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setIsDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4 shrink-0" />
            Delete chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader className="space-y-4">
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>
              “{title || 'New chat'}” and its history will be removed. The
              generated project files stay on disk.
            </DialogDescription>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteChat}>
                Delete
              </Button>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const SideBarItem = memo(
  SideBarItemComponent,
  (prev, next) =>
    prev.currentChatId === next.currentChatId &&
    prev.id === next.id &&
    prev.title === next.title
);

SideBarItem.displayName = 'SideBarItem';
