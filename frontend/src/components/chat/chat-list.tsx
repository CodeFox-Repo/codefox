'use client';

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeDisplayBlock from '../code-display-block';
import { Message } from '../../const/MessageType';
import { Button } from '../ui/button';
import {
  Check,
  Pencil,
  X,
  Code,
  Copy,
  Trash2,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { useAuthContext } from '@/providers/AuthProvider';
import ThinkingProcessBlock from './thinking-process-block';

interface ChatListProps {
  messages: Message[];
  loadingSubmit?: boolean;
  onMessageEdit?: (messageId: string, newContent: string) => void;
  thinkingProcess?: Message[];

  isTPUpdating: boolean;
}

const isUserMessage = (role: string) => role.toLowerCase() === 'user';

export default function ChatList({
  messages,
  loadingSubmit,
  onMessageEdit,
  thinkingProcess,

  isTPUpdating,
}: ChatListProps) {
  console.log(thinkingProcess);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthContext();

  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(
    null
  );
  const [editContent, setEditContent] = React.useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  if (!user) {
    return null;
  }

  const handleEditStart = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleEditSubmit = (messageId: string) => {
    if (onMessageEdit && editContent.trim()) {
      onMessageEdit(messageId, editContent);
    }
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const renderMessageContent = (content: string) => {
    return (
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className, node, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            return match ? (
              <CodeDisplayBlock code={String(children)} lang={match[1]} />
            ) : (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </Markdown>
    );
  };

  if (messages.length === 0) {
    return (
      <div className="w-full h-full flex justify-center items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center p-6 max-w-md"
        >
          <img
            src="/codefox.svg"
            alt="AI"
            className="h-24 w-24 mb-4 aspect-square object-contain dark:invert"
          />
          <h3 className="text-xl font-semibold mb-2">Welcome to CodeFox</h3>
          <p className="text-muted-foreground">
            Ask me anything about coding, project development, or technical
            problems. I&apos;m here to help!
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-y-auto overflow-x-hidden h-full px-4 py-6">
      <div className="w-full flex flex-col gap-3 min-h-full pb-4 max-w-3xl mx-auto">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => {
            const isUser = isUserMessage(message.role);
            const isEditing = message.id === editingMessageId;

            return (
              <motion.div
                key={`${message.id}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{
                  opacity: { duration: 0.15 },
                  y: { duration: 0.15 },
                }}
                className="flex gap-3 items-start"
              >
                <div className="flex-shrink-0 mt-1">
                  <Avatar
                    className={cn(
                      'h-6 w-6',
                      isUser ? 'bg-primary/10' : 'bg-secondary/10'
                    )}
                  >
                    {isUser ? (
                      <>
                        <AvatarImage src="/" alt="user" />
                        <AvatarFallback className="text-primary-foreground text-xs">
                          {user.username?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </>
                    ) : (
                      <>
                        <AvatarImage
                          src="/codefox.svg"
                          alt="AI"
                          className="p-1 dark:invert"
                        />
                        <AvatarFallback className="text-secondary-foreground">
                          AI
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                </div>

                <div className="flex-grow flex flex-col gap-2">
                  {isEditing ? (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <div className="text-xs text-muted-foreground">
                            Edit
                          </div>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="min-h-[200px] w-full p-2 rounded bg-background border resize-none text-foreground font-mono"
                            autoFocus
                            placeholder="Support Markdown formatting..."
                            onKeyDown={(e) => {
                              if (e.key === 'Tab') {
                                e.preventDefault();
                                const start = e.currentTarget.selectionStart;
                                const end = e.currentTarget.selectionEnd;
                                setEditContent(
                                  editContent.substring(0, start) +
                                    '  ' +
                                    editContent.substring(end)
                                );
                                // Set cursor position after timeout to ensure state is updated
                                setTimeout(() => {
                                  e.currentTarget.selectionStart =
                                    e.currentTarget.selectionEnd = start + 2;
                                }, 0);
                              }
                            }}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="text-xs text-muted-foreground">
                            Preview
                          </div>
                          <div className="min-h-[200px] w-full p-2 rounded bg-muted prose dark:prose-invert prose-sm max-w-none overflow-auto">
                            <Markdown remarkPlugins={[remarkGfm]}>
                              {editContent}
                            </Markdown>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleEditCancel}
                          className="h-7 px-2 text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleEditSubmit(message.id)}
                          className="h-7 px-2 text-xs"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div
                        className={cn(
                          'px-4 py-1 rounded-lg break-words',
                          !isUser
                            ? 'bg-card text-card-foreground'
                            : 'text-foreground'
                        )}
                      >
                        {isUser ? (
                          <div className="prose dark:prose-invert prose-sm max-w-none">
                            <div className="mt-4 prose dark:prose-invert prose-sm max-w-none">
                              {renderMessageContent(message.content)}
                            </div>
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const tpMsg = thinkingProcess.find(
                                (tp) => tp.id === message.id
                              );
                              if (tpMsg) {
                                return (
                                  <ThinkingProcessBlock
                                    key={message.id}
                                    thinking={tpMsg}
                                  />
                                );
                              }
                              return null;
                            })()}

                            <div className="mt-4 prose dark:prose-invert prose-sm max-w-none">
                              {renderMessageContent(message.content)}
                            </div>
                          </>
                        )}
                      </div>
                      {/* Action buttons */}
                      <div className="px-2 flex gap-2">
                        {isUser ? (
                          <>
                            {onMessageEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => handleEditStart(message)}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {loadingSubmit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3 items-start"
          >
            <div className="flex-shrink-0 mt-1">
              <Avatar className="h-6 w-6 bg-secondary/10">
                <AvatarImage
                  src="/codefox.svg"
                  alt="AI"
                  className="p-1 dark:invert"
                />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-grow">
              <div className="px-4 py-2 flex flex-col">
                {isTPUpdating &&
                  thinkingProcess &&
                  thinkingProcess.length > 0 && (
                    <ThinkingProcessBlock
                      key="loading-tp"
                      thinking={thinkingProcess[thinkingProcess.length - 1]}
                    />
                  )}
                <div className="flex items-center mt-2">
                  <div className="flex gap-1.5">
                    <span className="size-2 rounded-full bg-foreground/30 animate-bounce"></span>
                    <span
                      className="size-2 rounded-full bg-foreground/30 animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    ></span>
                    <span
                      className="size-2 rounded-full bg-foreground/30 animate-bounce"
                      style={{ animationDelay: '0.4s' }}
                    ></span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
