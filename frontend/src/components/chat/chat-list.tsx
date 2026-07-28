'use client';

import { FoxMark } from '@/components/root/fox-mark';
import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { cjk } from '@streamdown/cjk';
import { Message } from '../../const/MessageType';
import { TurnTrail } from './turn-trail';
import { Button } from '../ui/button';
import { Copy, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthContext } from '@/providers/AuthProvider';

interface ChatListProps {
  messages: Message[];
  loadingSubmit?: boolean;
  /** Re-run the last user turn; shown only on the trailing answer. */
  onRegenerate?: () => void;
}

const isUserMessage = (role: string) => role.toLowerCase() === 'user';

export default function ChatList({
  messages,
  loadingSubmit,
  onRegenerate,
}: ChatListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthContext();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  if (!user) {
    return null;
  }

  const copyMessage = (content: string) =>
    navigator.clipboard
      .writeText(content)
      .then(() => toast.success('Copied'))
      .catch(() => toast.error('Could not copy'));

  /**
   * Markdown that is still being written.
   *
   * react-markdown parses whatever it is handed as a finished document, so a
   * half-arrived fenced block or table rendered as literal backticks and pipes
   * until the closing token showed up, and every code block reflowed on each
   * token. Streamdown parses for the streaming case, and its code plugin
   * highlights with the same two Shiki themes the app already switches
   * between; `cjk` keeps Chinese from being broken mid-word.
   */
  const PLUGINS = { code, cjk };

  // Turns that produced nothing (a failed stream, or history saved before the
  // empty-reply guard) would otherwise render as a blank bubble with action
  // buttons under it.
  const visible = messages.filter(
    (m) => m.role === 'user' || m.content?.trim()
  );

  /**
   * The bubble still being written: the last one, from the agent, while a turn
   * is in flight. `loadingSubmit` stays true for the whole turn — it is
   * cleared in the request's `finally` — so it covers the streaming window and
   * not just the wait before the first token.
   */
  /**
   * The gap between pressing send and the first thing the agent says.
   *
   * Once its bubble exists it carries its own progress — the notes open with
   * a pulse, the text types — so leaving this up as well put the same fact on
   * screen three times, the last of them an empty message.
   */
  const waiting =
    Boolean(loadingSubmit) &&
    (visible.length === 0 || isUserMessage(visible[visible.length - 1].role));

  const isStreaming = (index: number) =>
    Boolean(loadingSubmit) &&
    index === visible.length - 1 &&
    !isUserMessage(visible[index].role);

  const renderMessageContent = (content: string, streaming = false) => (
    <Streamdown
      plugins={PLUGINS}
      mode={streaming ? 'streaming' : 'static'}
      isAnimating={streaming}
      caret={streaming ? 'block' : undefined}
      shikiTheme={['github-light', 'github-dark']}
    >
      {content}
    </Streamdown>
  );

  if (messages.length === 0) {
    return (
      <div className="w-full h-full flex justify-center items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center p-6 max-w-md"
        >
          <FoxMark className="h-20 w-20 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Welcome to CodeFox</h3>
          <p className="text-muted-foreground">
            Tell the agent what to build or change — it edits this project's
            real files and the preview updates beside you.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-y-auto overflow-x-hidden h-full px-4 py-6">
      <div className="w-full flex flex-col gap-3 min-h-full pb-4 max-w-3xl mx-auto">
        <AnimatePresence initial={false}>
          {visible.map((message, index) => {
            const isUser = isUserMessage(message.role);
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
                className="group/msg flex items-start gap-3"
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
                        <FoxMark className="h-full w-full p-1" />
                        <AvatarFallback className="text-secondary-foreground">
                          AI
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                </div>

                {/* The edit-message UI that lived here was a stage prop: it
                    rewrote the local array, persisted nothing, and the agent
                    never saw the change. Gone until editing can mean
                    something (re-run from the edited turn). */}
                <div className="flex-grow flex flex-col gap-2">
                  <div className="flex flex-col gap-2">
                    <div
                      className={cn(
                        'px-4 py-1 rounded-lg break-words',
                        !isUser
                          ? 'bg-card text-card-foreground'
                          : 'text-foreground'
                      )}
                    >
                      {isUser || !message.steps ? (
                        <div className="prose dark:prose-invert prose-sm mt-4 max-w-none">
                          {renderMessageContent(
                            message.content,
                            !isUser && isStreaming(index)
                          )}
                        </div>
                      ) : (
                        // A live turn carries its own trail: the working
                        // notes above, foldable, and the answer below.
                        <div className="mt-4">
                          <TurnTrail
                            steps={message.steps}
                            streaming={isStreaming(index)}
                          />
                        </div>
                      )}
                    </div>
                    {/* Revealed on hover / keyboard focus. Delete, regenerate
                        and thumbs were here too, as icons with no onClick and
                        no backend behind them — buttons that do nothing are
                        worse than none. */}
                    <div className="flex gap-1 px-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        aria-label="Copy message"
                        onClick={() => copyMessage(message.content)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {!isUser &&
                        index === visible.length - 1 &&
                        onRegenerate &&
                        !loadingSubmit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            aria-label="Regenerate answer"
                            onClick={onRegenerate}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {waiting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3 items-start"
          >
            <div className="flex-shrink-0 mt-1">
              <Avatar className="h-6 w-6 bg-secondary/10">
                <FoxMark className="h-full w-full p-1" />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-grow">
              <div className="px-4 py-2 flex flex-col">
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
