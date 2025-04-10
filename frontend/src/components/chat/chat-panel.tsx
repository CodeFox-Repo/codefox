'use client';

import React from 'react';
import { motion } from 'framer-motion';
import ChatBottombar from './chat-bottombar';
import ChatTopbar from './chat-topbar';
import { ChatRequestOptions, Message } from '../../const/MessageType';
import ChatList from './chat-list';

export interface ChatProps {
  chatId?: string;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
  messages: Message[];
  thinkingProcess: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (
    e: React.FormEvent<HTMLFormElement>,
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  loadingSubmit?: boolean;
  stop: () => void;
  formRef: React.RefObject<HTMLFormElement>;
  isMobile?: boolean;
  setInput?: React.Dispatch<React.SetStateAction<string>>;
  setMessages: (messages: Message[]) => void;
  setThinkingProcess: React.Dispatch<React.SetStateAction<string[]>>;
  isTPUpdating: boolean;
  isInspectMode?: boolean;
  setIsInspectMode?: React.Dispatch<React.SetStateAction<boolean>>;
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
  formRef,
  isMobile,
  setInput,
  setMessages,
  thinkingProcess,
  setThinkingProcess,
  isTPUpdating,
  isInspectMode,
  setIsInspectMode,
}: ChatProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col justify-between w-full h-full p-2 rounded-lg shadow-sm border"
    >
      <div className="sticky top-0 z-10">
        <ChatTopbar />
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
          thinkingProcess={thinkingProcess}
          isTPUpdating={isTPUpdating}
        />
      </div>

      <div className="sticky bottom-0 z-10 bg-gradient-to-t from-background to-transparent pt-2">
        <ChatBottombar
          messages={messages}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          stop={stop}
          formRef={formRef}
          setInput={setInput}
          setMessages={setMessages}
          setSelectedModel={setSelectedModel}
          isInspectMode={isInspectMode}
          setIsInspectMode={setIsInspectMode}
        />
      </div>
    </motion.div>
  );
}
