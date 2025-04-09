'use client';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextareaAutosize from 'react-textarea-autosize';
import { PaperclipIcon, Send, X, Code, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message } from '../../const/MessageType';
import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ComponentInspector } from './code-engine/component-inspector';
import { Badge } from '@/components/ui/badge';

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
  isInspectMode?: boolean;
  setIsInspectMode?: React.Dispatch<React.SetStateAction<boolean>>;
}

// Add subtle pulse animation for Component Mode badge
const pulseBadge = {
  initial: { scale: 1 },
  animate: { 
    scale: [1, 1.03, 1],
    transition: { 
      repeat: Infinity, 
      repeatType: "mirror" as const, 
      duration: 2,
      ease: "easeInOut"
    }
  }
};

export default function ChatBottombar({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  formRef,
  setInput,
  setMessages,
  setSelectedModel,
  isInspectMode,
  setIsInspectMode,
}: ChatBottombarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isComponentMode, setIsComponentMode] = useState(false);
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

  const populateChatInput = (content: string) => {
    if (setInput) {
      setInput(content);
      setIsComponentMode(true);
      // Focus the input after populating
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // Check if input still contains component text
  useEffect(() => {
    if (input.includes('Help me modify this component:')) {
      setIsComponentMode(true);
    } else {
      setIsComponentMode(false);
    }
  }, [input]);

  // Function to exit component mode
  const exitComponentMode = () => {
    if (setInput) {
      setInput('');
      setIsComponentMode(false);
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className="px-4 pb-4 pt-2 bg-white dark:bg-[#151718] relative">
      {/* Component Inspector Popup */}
      <AnimatePresence>
        {isInspectMode && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-0 right-0 z-50 bg-background border border-input shadow-xl flex flex-col"
            style={{ 
              height: "min(600px, 70vh)",
              maxHeight: "calc(100vh - 150px)" 
            }}
          >
            {/* Resizable handle - positioned at the top of the panel */}
            <div 
              className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize bg-transparent hover:bg-blue-500/20 transition-colors z-10" 
              onMouseDown={(e) => {
                e.preventDefault();
                
                // Store references to elements and initial values
                const panel = e.currentTarget.parentElement;
                if (!panel) return;
                
                const startY = e.clientY;
                const startHeight = panel.getBoundingClientRect().height;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  // Stop propagation to prevent other events
                  moveEvent.preventDefault();
                  moveEvent.stopPropagation();
                  
                  // Calculate new height
                  const delta = startY - moveEvent.clientY;
                  const newHeight = Math.min(
                    Math.max(startHeight + delta, 100), // Min height reduced to 100px
                    window.innerHeight - 150 // Max height
                  );
                  
                  // Apply new height to the stored panel reference
                  if (panel) {
                    panel.style.height = `${newHeight}px`;
                  }
                };
                
                const handleMouseUp = () => {
                  // Clean up all event listeners
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                // Add the event listeners to document
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
            
            <div className="border-b px-3 py-2 flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 flex-shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                <Code className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <h3 className="font-medium text-blue-700 dark:text-blue-300 text-sm whitespace-nowrap overflow-hidden text-ellipsis">UI Inspector</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-600/70 dark:text-blue-400/70 hidden sm:inline">
                  Edit UI components directly
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (setIsInspectMode) {
                      setIsInspectMode(false);
                      localStorage.setItem('inspectModeEnabled', 'false');
                    }
                  }}
                  className="h-6 w-6 rounded-md flex-shrink-0 flex items-center justify-center hover:bg-blue-200 text-blue-600 dark:hover:bg-blue-800/30 dark:text-blue-300"
                  aria-label="Close UI Edit Mode"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <ComponentInspector 
                setIsInspectMode={setIsInspectMode}
                populateChatInput={populateChatInput}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        
      {/* Component Mode Badge - outside and above the input box */}
      <AnimatePresence>
        {isComponentMode && (
          <motion.div 
            initial={{ y: -5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -5, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-end gap-1.5 mb-1.5 pr-0.5"
          >
            <motion.div
              variants={pulseBadge}
              initial="initial"
              animate="animate"
            >
              <Badge 
                variant="outline" 
                className="flex items-center gap-1 text-[10px] py-0.5 px-2 bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/50 shadow-sm"
              >
                <Wand2 className="w-2.5 h-2.5" />
                <span>Component Mode</span>
              </Badge>
            </motion.div>
            <button
              type="button"
              onClick={exitComponentMode}
              className="h-4 w-4 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-800/60"
              aria-label="Exit component mode"
            >
              <X className="h-2 w-2" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
        
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'relative border shadow-sm rounded-lg overflow-hidden',
          isFocused
            ? 'ring-1 ring-blue-500 border-blue-500'
            : 'border-gray-200 hover:border-gray-300 dark:border-zinc-700 dark:hover:border-zinc-600',
          isComponentMode 
            ? 'bg-purple-50/20 dark:bg-purple-900/5' 
            : 'bg-white dark:bg-[#1e1e1e]'
        )}
      >
        {/* Component mode indicator */}
        {isComponentMode && (
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r" />
        )}
        
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
          </div>

          {/* Add Edit UI button */}
          {setIsInspectMode && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      const newValue = !isInspectMode;
                      setIsInspectMode(newValue);
                      // Save to localStorage for persistence
                      localStorage.setItem('inspectModeEnabled', newValue.toString());
                    }}
                    className={cn(
                      'h-7 w-7 rounded-md flex items-center justify-center',
                      isInspectMode 
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200'
                    )}
                    aria-label="Toggle UI Edit Mode"
                  >
                    <Code className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{isInspectMode ? 'Disable' : 'Enable'} UI Edit Mode</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Text input */}
          <div className="relative flex-1 flex items-center">
            <AnimatePresence>
              {isComponentMode && (
                <motion.div 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "2px" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="absolute left-0 top-1/2 transform -translate-y-1/2 h-[60%] bg-gradient-to-b rounded-r-full"
                />
              )}
            </AnimatePresence>
            <TextareaAutosize
              autoComplete="off"
              value={input}
              ref={inputRef}
              onKeyDown={handleKeyPress}
              onChange={handleInputChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              name="message"
              placeholder={isComponentMode ? "Describe what you want to change..." : "Message Agent..."}
              className={cn(
                "resize-none px-2 w-full focus:outline-none bg-transparent text-gray-800 dark:text-zinc-200 text-sm placeholder:text-gray-400 dark:placeholder:text-zinc-400",
                isComponentMode ? "pt-4 pb-2.5" : "py-2.5"
              )}
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
