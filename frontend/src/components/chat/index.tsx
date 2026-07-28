'use client';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  DROP_LAST_ASSISTANT_REPLY,
  GET_CHAT_HISTORY,
  UPDATE_CHAT_MODEL,
} from '@/graphql/request';
import { useMutation, useQuery } from '@apollo/client';
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
  const { isReady, projectId, chatModel, error } =
    useProjectStatusMonitor(chatId);

  // The chat remembers which model it was created with; prefer that over the
  // head of the configured list, so the first turn runs on what was picked.
  useEffect(() => {
    if (chatModel) setSelectedModel(chatModel);
  }, [chatModel]);

  // Switching mid-chat sticks: the choice is written back to the chat so a
  // reload does not silently revert to the creation-time model.
  const [updateChatModel] = useMutation(UPDATE_CHAT_MODEL);
  const changeModel = useCallback(
    (model: string) => {
      setSelectedModel(model);
      if (chatId) {
        updateChatModel({ variables: { chatId, model } }).catch(() =>
          toast.error('Could not save the model choice')
        );
      }
    },
    [chatId, updateChatModel]
  );

  // Apollo query to fetch chat history
  useQuery(GET_CHAT_HISTORY, {
    variables: { chatId },
    skip: !isAuthorized || !chatId,
    onCompleted: (data) => {
      if (data?.getChatHistory) {
        const processedMessages = data.getChatHistory.map((msg) => {
          // `steps` is what lets a reloaded turn fold its work back open;
          // messages saved before it existed simply have none.
          const steps = msg.steps?.length ? msg.steps : undefined;
          try {
            const content = JSON.parse(msg.content);
            return {
              id: msg.id,
              role: msg.role,
              content: content.final_response,
              createdAt: msg.createdAt,
              steps,
            };
          } catch (e) {
            return { ...msg, steps };
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
  const {
    loadingSubmit,
    handleSubmit,
    handleInputChange,
    startTurn,
    stop,
    activity,
  } = useChatStream({
    chatId,
    input,
    setInput,
    setMessages,
    selectedModel,
  });

  // A chat arriving from the home page holds one stored user message and no
  // reply — createProject saved the prompt, but nothing ever ran the turn.
  // Run it here, once the project is bound (before that the backend has no
  // project directory and would fall back to a plain completion).
  // GraphQL serializes the role enum as its key ('User'), so compare loosely.
  const needsFirstTurn =
    messages.length === 1 && /user/i.test(messages[0].role) && !loadingSubmit;
  const firstTurnStartedFor = useRef<string | null>(null);
  // Right after creation the backend can still be provisioning the project's
  // sandbox and rejects the turn outright; startTurn rejects only when nothing
  // streamed yet, which is safe to retry. ~1 minute covers a slow microVM.
  const MAX_FIRST_TURN_ATTEMPTS = 10;
  const [firstTurnAttempt, setFirstTurnAttempt] = useState(0);
  useEffect(() => {
    if (!chatId || !isReady || !needsFirstTurn) return;
    if (firstTurnStartedFor.current === chatId) return;
    firstTurnStartedFor.current = chatId;
    startTurn(chatId, messages[0].content, chatModel).catch(() => {
      if (firstTurnAttempt + 1 >= MAX_FIRST_TURN_ATTEMPTS) {
        setFirstTurnAttempt(MAX_FIRST_TURN_ATTEMPTS);
        toast.error('Failed to get chat response');
        return;
      }
      setTimeout(() => {
        firstTurnStartedFor.current = null;
        setFirstTurnAttempt((n) => n + 1);
      }, 6000);
    });
  }, [
    chatId,
    isReady,
    needsFirstTurn,
    messages,
    startTurn,
    firstTurnAttempt,
    chatModel,
  ]);

  // Until the turn is running, the wait (scaffolding, binding, retries) still
  // deserves a thinking indicator instead of a silent page. `error` is the
  // monitor giving up — stop promising work that is not coming.
  const waitingForFirstTurn =
    needsFirstTurn && !error && firstTurnAttempt < MAX_FIRST_TURN_ATTEMPTS;

  // Re-run the last question: drop the stored trailing reply first so history
  // does not keep both answers, then run the turn again like the first one.
  const [dropLastAssistantReply] = useMutation(DROP_LAST_ASSISTANT_REPLY);
  const regenerate = useCallback(async () => {
    if (loadingSubmit || !chatId) return;
    const lastUser = [...messages].reverse().find((m) => /user/i.test(m.role));
    if (!lastUser) return;
    try {
      await dropLastAssistantReply({ variables: { chatId } });
    } catch {
      toast.error('Could not discard the previous answer');
      return;
    }
    setMessages((prev) => {
      const next = [...prev];
      while (next.length && !/user/i.test(next[next.length - 1].role))
        next.pop();
      return next;
    });
    startTurn(chatId, lastUser.content).catch(() =>
      toast.error('Failed to get chat response')
    );
  }, [loadingSubmit, chatId, messages, dropLastAssistantReply, startTurn]);

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
            models={models}
            selectedModel={selectedModel}
            onModelChange={changeModel}
            onRegenerate={regenerate}
            messages={messages}
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            loadingSubmit={loadingSubmit || waitingForFirstTurn}
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
