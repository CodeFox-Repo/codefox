'use client';

import React from 'react';
import { motion } from 'framer-motion';
import ChatBottombar from './chat-bottombar';
import ChatTopbar from './chat-topbar';
import { Message } from '../../const/MessageType';
import ChatList from './chat-list';

export interface ChatProps {
  chatId?: string;
  /** Configured model ids, for the in-chat picker. */
  models?: string[];
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  /** Re-run the last user turn, replacing the trailing answer. */
  onRegenerate?: () => void;
  /** Send the composed answer of the planner's question card. */
  onAnswerQuestions?: (answer: string) => void;
  /** True while an unanswered question card is the way forward. */
  inputHidden?: boolean;
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (
    e: React.FormEvent<HTMLFormElement>,
    images?: string[]
  ) => void;
  loadingSubmit?: boolean;
  activity?: { tool?: string; file?: string } | null;
  stop: () => void;
  formRef: React.RefObject<HTMLFormElement>;
  isMobile?: boolean;
  setInput?: React.Dispatch<React.SetStateAction<string>>;
  setMessages: (messages: Message[]) => void;
  queued?: string[];
  onQueue?: (text: string) => void;
  onClearQueue?: () => void;
}

export default function ChatContent({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  stop,
  chatId,
  models,
  selectedModel,
  onModelChange,
  onRegenerate,
  onAnswerQuestions,
  inputHidden,
  loadingSubmit,
  activity,
  formRef,
  isMobile,
  setInput,
  setMessages,
  queued,
  onQueue,
  onClearQueue,
}: ChatProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex h-full w-full flex-col justify-between"
    >
      <div className="sticky top-0 z-10">
        <ChatTopbar chatId={chatId} onHistoryCleared={() => setMessages([])} />
      </div>

      <div className="flex-grow overflow-hidden">
        <ChatList
          messages={messages}
          loadingSubmit={loadingSubmit}
          onRegenerate={onRegenerate}
          onAnswerQuestions={onAnswerQuestions}
        />
      </div>

      <div className="sticky bottom-0 z-10 bg-gradient-to-t from-background to-transparent pt-2">
        <ChatBottombar
          inputHidden={inputHidden}
          messages={messages}
          models={models}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          stop={stop}
          isStreaming={loadingSubmit}
          activity={activity}
          formRef={formRef}
          setInput={setInput}
          setMessages={setMessages}
          queued={queued}
          onQueue={onQueue}
          onClearQueue={onClearQueue}
        />
        {/* Under the composer, not inside its row: on a narrow panel this link
            was taking half the width the textarea needed. */}
        {!inputHidden && (
          <div className="px-3 pb-1.5 pt-1 text-right">
            <a
              href="https://github.com/Sma1lboy/codefox/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Have feedback?
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}
