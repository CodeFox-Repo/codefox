'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { CLEAR_CHAT_HISTORY } from '@/graphql/request';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ClearHistoryDialogProps {
  chatId?: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleared?: () => void;
}

/** Both chat menus use the same confirmation and in-flight guard. */
export function ClearHistoryDialog({
  chatId,
  title,
  open,
  onOpenChange,
  onCleared,
}: ClearHistoryDialogProps) {
  const [clearHistory] = useMutation(CLEAR_CHAT_HISTORY);
  const [clearing, setClearing] = useState(false);
  const pending = useRef(false);
  const activeChatId = useRef(chatId);
  activeChatId.current = chatId;
  useEffect(() => {
    activeChatId.current = chatId;
    return () => {
      activeChatId.current = undefined;
    };
  }, [chatId]);

  const handleClear = async () => {
    if (!chatId || pending.current) return;
    pending.current = true;
    setClearing(true);
    try {
      const { data } = await clearHistory({ variables: { chatId } });
      if (!data?.clearChatHistory) throw new Error('History was not cleared');
      // A response for the previous chat must not empty the new chat's UI.
      if (activeChatId.current !== chatId) return;
      onCleared?.();
      toast.success('Chat history cleared');
      onOpenChange(false);
    } catch {
      if (activeChatId.current === chatId) {
        toast.error('Could not clear chat history. Try again.');
      }
    } finally {
      pending.current = false;
      setClearing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending.current) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader className="space-y-4">
          <DialogTitle>Clear chat history?</DialogTitle>
          <DialogDescription>
            All messages in “{title || 'Untitled'}” will be removed. Your
            project files stay. This cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={clearing}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={clearing || !chatId}
              aria-busy={clearing}
              onClick={handleClear}
            >
              {clearing ? 'Clearing history…' : 'Clear history'}
            </Button>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
