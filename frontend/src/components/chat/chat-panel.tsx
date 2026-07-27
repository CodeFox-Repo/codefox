'use client';

import React from 'react';
import { motion } from 'framer-motion';
import ChatBottombar from './chat-bottombar';
import ChatTopbar from './chat-topbar';
import { Message } from '../../const/MessageType';
import ChatList from './chat-list';

export interface ChatProps {
  chatId?: string;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
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
}

export default function ChatContent({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  stop,
  setSelectedModel,
  chatId,
  loadingSubmit,
  activity,
  formRef,
  isMobile,
  setInput,
  setMessages,
}: ChatProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex h-full w-full flex-col justify-between"
    >
      <div className="sticky top-0 z-10">
        <ChatTopbar chatId={chatId} />
      </div>

      <div className="flex-grow overflow-hidden">
        <ChatList
          messages={messages}
          loadingSubmit={loadingSubmit}
          onMessageEdit={(messageId, newContent) => {
            const updatedMessages = messages.map((msg) =>
              msg.id === messageId ? { ...msg, content: newContent } : msg
            );
            setMessages(updatedMessages);
          }}
        />
      </div>

      <div className="sticky bottom-0 z-10 bg-gradient-to-t from-background to-transparent pt-2">
        <ChatBottombar
          messages={messages}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          stop={stop}
          isStreaming={loadingSubmit}
          activity={activity}
          formRef={formRef}
          setInput={setInput}
          setMessages={setMessages}
          setSelectedModel={setSelectedModel}
        />
      </div>
    </motion.div>
  );
}
