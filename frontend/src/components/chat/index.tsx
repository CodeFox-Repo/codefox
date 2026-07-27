'use client';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { GET_CHAT_HISTORY } from '@/graphql/request';
import { useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { EventEnum } from '@/const/EventEnum';
import ChatContent from '@/components/chat/chat-panel';
import { useModels } from '@/hooks/useModels';
import { useChatList } from '@/hooks/useChatList';
import { useChatStream } from '@/hooks/useChatStream';
import { CodeEngine } from './code-engine/code-engine';
import { useProjectStatusMonitor } from '@/hooks/useProjectStatusMonitor';
import { useAuthContext } from '@/providers/AuthProvider';

export default function Chat() {
  // Initialize state, refs, and custom hooks
  const { isAuthorized } = useAuthContext();
  const urlParams = new URLSearchParams(window.location.search);
  const [chatId, setChatId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const { models } = useModels();
  // useModels resolves asynchronously, so seeding state from models[0] at mount
  // pins whatever the fallback was. Adopt the first real model once it lands;
  // until then send '' and let the backend apply its configured default.
  const [selectedModel, setSelectedModel] = useState('');
  useEffect(() => {
    if (!selectedModel && models.length > 0) setSelectedModel(models[0]);
  }, [models, selectedModel]);
  const { refetchChats } = useChatList();

  // Project status monitoring for the current chat
  const { isReady, projectId, projectName, error } =
    useProjectStatusMonitor(chatId);

  // Apollo query to fetch chat history
  useQuery(GET_CHAT_HISTORY, {
    variables: { chatId },
    skip: !isAuthorized || !chatId,
    onCompleted: (data) => {
      if (data?.getChatHistory) {
        const processedMessages = data.getChatHistory.map((msg) => {
          try {
            const content = JSON.parse(msg.content);
            return {
              id: msg.id,
              role: msg.role,
              content: content.final_response,
              createdAt: msg.createdAt,
            };
          } catch (e) {
            return msg;
          }
        });

        setMessages(processedMessages);
      }
    },
    onError: () => {
      toast.error('Failed to load chat history');
    },
  });

  // Custom hook for handling chat streaming
  const { loadingSubmit, handleSubmit, handleInputChange, stop, activity } =
    useChatStream({
      chatId,
      input,
      setInput,
      setMessages,
      selectedModel,
    });

  // Callback to clear the chat ID
  const cleanChatId = () => setChatId('');

  // Callback to update chat ID based on URL parameters and refresh the chat list
  const updateChatId = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    setChatId(params.get('id') || '');
    refetchChats();
  }, [refetchChats]);

  // Callback to switch to the settings view
  const updateSetting = () => setChatId(EventEnum.SETTING);
  const updateProject = () => setChatId(EventEnum.NEW_PROJECT);

  // Effect to initialize chat ID and refresh the chat list based on URL parameters
  useEffect(() => {
    const newChatId = urlParams.get('id') || '';
    if (newChatId !== chatId) {
      setChatId(newChatId);
      refetchChats();
    }
  }, [urlParams, chatId, refetchChats]);

  // Effect to add and remove global event listeners
  useEffect(() => {
    window.addEventListener(EventEnum.CHAT, updateChatId);
    window.addEventListener(EventEnum.NEW_CHAT, cleanChatId);
    window.addEventListener(EventEnum.SETTING, updateSetting);
    window.addEventListener(EventEnum.NEW_PROJECT, updateProject);
    return () => {
      window.removeEventListener(EventEnum.CHAT, updateChatId);
      window.removeEventListener(EventEnum.NEW_PROJECT, updateProject);
      window.removeEventListener(EventEnum.NEW_CHAT, cleanChatId);
      window.removeEventListener(EventEnum.SETTING, updateSetting);
    };
  }, [updateChatId]);

  // Render the main layout
  return chatId ? (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-full w-full"
      key="with-chat"
    >
      <ResizablePanel
        defaultSize={40}
        minSize={20}
        maxSize={70}
        className="h-full"
      >
        <div className="h-full overflow-hidden">
          <ChatContent
            chatId={chatId}
            setSelectedModel={setSelectedModel}
            messages={messages}
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            loadingSubmit={loadingSubmit}
            activity={activity}
            stop={stop}
            formRef={formRef}
            setInput={setInput}
            setMessages={setMessages}
          />
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle className="w-px bg-border" />

      <ResizablePanel
        defaultSize={60}
        minSize={30}
        maxSize={80}
        className="h-full"
      >
        <div className="h-full overflow-auto">
          <CodeEngine
            chatId={chatId}
            isProjectReady={isReady}
            projectId={projectId}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ) : (
    <div className="h-full w-full" key="without-chat">
      <ChatContent
        chatId={chatId}
        setSelectedModel={setSelectedModel}
        messages={messages}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        loadingSubmit={loadingSubmit}
        stop={stop}
        formRef={formRef}
        setInput={setInput}
        setMessages={setMessages}
      />
    </div>
  );
}
