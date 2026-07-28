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

interface ChatBottombarProps {
  messages: Message[];
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
}

export default function ChatBottombar({
  messages,
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) return;
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

            {/* Mid-chat model switch; the choice persists on the chat. */}
            {onModelChange && (models?.length ?? 0) > 1 && (
              <Select
                value={selectedModel}
                onValueChange={onModelChange}
                disabled={isStreaming}
              >
                <SelectTrigger
                  aria-label="Model"
                  className="ml-1 h-7 max-w-[180px] border-none bg-transparent px-2 font-mono text-[11px] text-muted-foreground shadow-none hover:text-foreground focus:ring-0"
                >
                  <SelectValue placeholder="model" />
                </SelectTrigger>
                <SelectContent>
                  {models!.map((m) => (
                    <SelectItem key={m} value={m} className="font-mono text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Text input */}
          <div className="relative flex-1 flex items-center">
            <TextareaAutosize
              autoComplete="off"
              value={input}
              ref={inputRef}
              onKeyDown={handleKeyPress}
              onPaste={handlePaste}
              disabled={isStreaming}
              onChange={handleInputChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              name="message"
              placeholder={
                isStreaming ? 'Agent is working…' : 'Message Agent...'
              }
              className="resize-none px-2 py-2.5 w-full focus:outline-none bg-transparent text-foreground text-sm placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
              maxRows={5}
            />
          </div>

          {/* Right side - feedback & send */}
          <div className="flex items-center mr-2 gap-2">
            {/* A bare span said "Have feedback?" and led nowhere. */}
            <a
              href="https://github.com/Sma1lboy/codefox/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Have feedback?
            </a>

            {isStreaming ? (
              <button
                type="button"
                onClick={stop}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                aria-label="Stop the agent"
              >
                <Square className="h-3 w-3" fill="currentColor" />
              </button>
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
