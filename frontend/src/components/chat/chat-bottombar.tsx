'use client';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextareaAutosize from 'react-textarea-autosize';
import { PaperclipIcon, Send, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Message } from '../../const/MessageType';
import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * What the user picks between is a speed/depth trade, not a vendor id —
 * "google/gemini-3.7-flash@openrouter" tells them nothing. Ids without an
 * entry fall back to the raw tag so a config change still renders.
 */
const MODEL_LABELS: Record<string, string> = {
  'google/gemini-3.7-flash@openrouter': '快速 · Fast',
  'accounts/fireworks/models/qwen3p8-max': '强力 · Max',
};
const modelLabel = (id: string) => MODEL_LABELS[id] ?? id;

interface ChatBottombarProps {
  messages: Message[];
  /** The planner's question card is open; the composer steps aside. */
  inputHidden?: boolean;
  /** Configured model ids; the picker only shows when there is a choice. */
  models?: string[];
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (
    e: React.FormEvent<HTMLFormElement>,
    images?: string[]
  ) => void;
  stop: () => void;
  formRef: React.RefObject<HTMLFormElement>;
  setInput?: React.Dispatch<React.SetStateAction<string>>;
  setMessages: (messages: Message[]) => void;
  isStreaming?: boolean;
  activity?: { tool?: string; file?: string } | null;
  /** Messages typed while the agent was busy; sent as the next turn. */
  queued?: string[];
  onQueue?: (text: string) => void;
  onClearQueue?: () => void;
}

export default function ChatBottombar({
  messages,
  inputHidden,
  models,
  selectedModel,
  onModelChange,
  input,
  handleInputChange,
  handleSubmit,
  formRef,
  setInput,
  setMessages,
  stop,
  isStreaming = false,
  activity,
  queued = [],
  onQueue,
  onClearQueue,
}: ChatBottombarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkScreenWidth = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    // Initial check
    checkScreenWidth();
    // Event listener for screen width changes
    window.addEventListener('resize', checkScreenWidth);
    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener('resize', checkScreenWidth);
    };
  }, []);

  const queueCurrentInput = () => {
    if (!input.trim() || !onQueue) return;
    onQueue(input);
    setInput?.('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Mid-turn the message queues instead of vanishing — steering, not
      // a locked door.
      if (isStreaming) {
        queueCurrentInput();
        return;
      }
      submitWithAttachments(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const images = picked.filter((f) => f.type.startsWith('image/'));
    if (images.length < picked.length) {
      toast.error('Only images can be attached right now.');
    }
    if (images.length) setAttachments((prev) => [...prev, ...images]);
    e.target.value = ''; // let the same file be picked again
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Screenshots arrive as clipboard files, not text — grab them before the
  // textarea swallows the paste as an empty string.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (images.length === 0) return;
    e.preventDefault();
    setAttachments((prev) => [...prev, ...images]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Sent as data URLs, not prompt image parts: the claude-code harness rejects
  // non-text parts, so the backend writes these into the project and points the
  // agent at the paths instead.
  const submitWithAttachments = (e: React.FormEvent<HTMLFormElement>) => {
    if (attachments.length === 0) {
      handleSubmit(e);
      return;
    }

    e.preventDefault();
    const pending = attachments;
    Promise.all(
      pending.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })
      )
    )
      .then((images) => {
        setAttachments([]);
        handleSubmit(e, images);
      })
      .catch(() => toast.error('Could not read that image'));
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // While the planner's question card waits, the composer is not the way
  // forward — answering (or skipping) up in the card is.
  if (inputHidden) {
    return (
      <div className="bg-background px-4 pb-4 pt-2">
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-center font-mono text-xs text-muted-foreground">
          Answer the questions above to start building
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background px-4 pb-4 pt-2">
      {isStreaming && (
        <p className="mb-2 flex items-center gap-2 px-1 font-mono text-xs text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          {activity?.tool ? (
            <>
              <span className="text-primary">{activity.tool}</span>
              {activity.file && (
                <span className="truncate">{activity.file}</span>
              )}
            </>
          ) : (
            <span>thinking…</span>
          )}
          {queued.length > 0 && (
            <span className="ml-auto flex items-center gap-1.5">
              {queued.length} queued for the next turn
              <button
                type="button"
                onClick={onClearQueue}
                aria-label="Drop queued messages"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </p>
      )}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'relative border shadow-sm rounded-lg overflow-hidden',
          isFocused
            ? 'ring-1 ring-ring border-ring'
            : 'border-border hover:border-primary/45',
          'bg-card'
        )}
      >
        {/* Attachments preview */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-border p-2"
            >
              {/* No warning here: attachments are staged into the project's
                  workspace and the agent reads them with its own tools —
                  verified end-to-end, so the old "cannot read them yet"
                  banner had become a lie. */}
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <motion.div
                    key={`${file.name}-${index}`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="relative group"
                  >
                    <div className="w-16 h-16 rounded border overflow-hidden bg-secondary">
                      {file.type.startsWith('image/') ? (
                        <div className="relative w-full h-full">
                          <Image
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-1 overflow-hidden">
                          {file.name}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-border bg-background text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Its own row, under the input — not beside it. A ~180px picker in
            an 18% chat rail left the textarea ~34px, i.e. one character per
            line. Same squeeze "Have feedback?" caused, same fix: take it out
            of the input row rather than fight flex-basis. */}
        {onModelChange && (models?.length ?? 0) > 1 && (
          <div className="flex items-center border-b border-border/60 px-2 pt-1">
            <Select
              value={selectedModel}
              onValueChange={onModelChange}
              disabled={isStreaming}
            >
              <SelectTrigger
                aria-label="Model"
                className="h-6 w-auto gap-1 border-none bg-transparent px-1 font-mono text-[11px] text-muted-foreground shadow-none hover:text-foreground focus:ring-0"
              >
                <SelectValue placeholder="model" />
              </SelectTrigger>
              <SelectContent>
                {models!.map((m) => (
                  <SelectItem key={m} value={m} className="font-mono text-xs">
                    {modelLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <form
          ref={formRef}
          onSubmit={submitWithAttachments}
          className="flex items-center w-full"
        >
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
            multiple
          />

          {/* Left icons with tooltips */}
          <div className="flex items-center ml-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleFileSelect}
                    disabled={isStreaming}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Attach an image"
                  >
                    <PaperclipIcon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Attach an image — or just paste one</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Text input */}
          {/* min-w-0: a flex item's default min-width is its content, so
              without this the textarea refuses to give room back and the
              siblings win the squeeze instead. */}
          <div className="relative flex min-w-0 flex-1 items-center">
            <TextareaAutosize
              autoComplete="off"
              value={input}
              ref={inputRef}
              onKeyDown={handleKeyPress}
              onPaste={handlePaste}
              onChange={handleInputChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              name="message"
              placeholder={
                isStreaming
                  ? 'Keep typing — sends when the agent finishes this turn'
                  : 'Describe a change — the agent edits the real files'
              }
              className="resize-none px-2 py-2.5 w-full focus:outline-none bg-transparent text-foreground text-sm placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
              maxRows={5}
            />
          </div>

          {/* Right side - send. "Have feedback?" used to sit here and ate
              ~110px of a ~230px composer, squeezing the textarea to one
              character per line. It lives in the sidebar footer instead. */}
          <div className="flex shrink-0 items-center mr-2 gap-2">
            {isStreaming ? (
              <>
                {input.trim() && (
                  <button
                    type="button"
                    onClick={queueCurrentInput}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-foreground transition-colors hover:bg-accent"
                    aria-label="Queue for the next turn"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={stop}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                  aria-label="Stop the agent"
                >
                  <Square className="h-3 w-3" fill="currentColor" />
                </button>
              </>
            ) : (
              <button
                type="submit"
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  input.trim()
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'cursor-not-allowed bg-secondary text-muted-foreground'
                )}
                disabled={!input.trim()}
                aria-label="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
