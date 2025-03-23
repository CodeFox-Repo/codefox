'use client';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextareaAutosize from 'react-textarea-autosize';
import { PaperclipIcon, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message } from '../../const/MessageType';
import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ChatBottombarProps {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  stop: () => void;
  formRef: React.RefObject<HTMLFormElement>;
  setInput?: React.Dispatch<React.SetStateAction<string>>;
  setMessages: (messages: Message[]) => void;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
}

export default function ChatBottombar({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  formRef,
  setInput,
  setMessages,
  setSelectedModel,
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
      submitWithAttachments(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...fileArray]);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const submitWithAttachments = (e: React.FormEvent<HTMLFormElement>) => {
    // Here you would normally handle attachments with your form submission
    // For this example, we'll just clear them after submission
    handleSubmit(e);
    setAttachments([]);
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className="px-4 pb-4 pt-2 bg-white dark:bg-[#151718]">
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'relative border shadow-sm rounded-lg overflow-hidden',
          isFocused
            ? 'ring-1 ring-blue-500 border-blue-500'
            : 'border-gray-200 hover:border-gray-300 dark:border-zinc-700 dark:hover:border-zinc-600',
          'bg-white dark:bg-[#1e1e1e]'
        )}
      >
        {/* Attachments preview */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-2 p-2 border-b border-gray-100 dark:border-zinc-800"
            >
              {attachments.map((file, index) => (
                <motion.div
                  key={`${file.name}-${index}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="relative group"
                >
                  <div className="w-16 h-16 rounded border overflow-hidden bg-gray-50 dark:bg-zinc-800">
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
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 dark:text-zinc-400 p-1 overflow-hidden">
                        {file.name}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-1 -right-1 size-5 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="size-3" />
                  </button>
                </motion.div>
              ))}
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
                    className="p-1.5 text-gray-400 dark:text-zinc-400 rounded-md cursor-not-allowed opacity-50"
                    aria-label="Attach file (not available)"
                    disabled
                  >
                    <PaperclipIcon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Feature not available yet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="p-1.5 text-gray-400 dark:text-zinc-400 rounded-md cursor-not-allowed opacity-50"
                    aria-label="Record (not available)"
                    disabled
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="4"></circle>
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Feature not available yet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Text input */}
          <div className="relative flex-1 flex items-center">
            <TextareaAutosize
              autoComplete="off"
              value={input}
              ref={inputRef}
              onKeyDown={handleKeyPress}
              onChange={handleInputChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              name="message"
              placeholder="Message Agent..."
              className="resize-none px-2 py-2.5 w-full focus:outline-none bg-transparent text-gray-800 dark:text-zinc-200 text-sm placeholder:text-gray-400 dark:placeholder:text-zinc-400"
              maxRows={5}
            />
          </div>

          {/* Right side - feedback & send */}
          <div className="flex items-center mr-2 gap-2">
            <div className="text-sm text-gray-400 dark:text-zinc-400">
              <span>Have feedback?</span>
            </div>

            <button
              type="submit"
              className={cn(
                'h-7 w-7 rounded-md flex items-center justify-center',
                input.trim() || attachments.length > 0
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500'
              )}
              disabled={!input.trim() && attachments.length === 0}
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
