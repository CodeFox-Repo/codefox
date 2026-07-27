import { useState, useCallback, useEffect, useContext, useRef } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_CHAT, SAVE_MESSAGE } from '@/graphql/request';
import { Message } from '@/const/MessageType';
import { toast } from 'sonner';
import { logger } from '@/app/log/logger';
import { useAuthContext } from '@/providers/AuthProvider';
import { startChatStream } from '@/api/ChatStreamAPI';
import { ProjectContext } from '@/components/chat/code-engine/project-context';
import { ChatInputType } from '@/graphql/type';

export interface UseChatStreamProps {
  chatId: string;
  input: string;
  setInput: (input: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  selectedModel: string;
}

export const useChatStream = ({
  chatId,
  input,
  setInput,
  setMessages,
  selectedModel,
}: UseChatStreamProps) => {
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  /** What the agent is doing right now, surfaced while the turn streams. */
  const [activity, setActivity] = useState<{
    tool?: string;
    file?: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Attachments for the turn being submitted. A ref because the first turn of
   *  a new chat is dispatched from createChat's onCompleted, outside the
   *  handleSubmit closure. */
  const pendingImagesRef = useRef<string[] | undefined>(undefined);
  const [currentChatId, setCurrentChatId] = useState<string>(chatId);
  const { token } = useAuthContext();
  const { curProject, refreshProjects, setFilePath, editorRef } =
    useContext(ProjectContext);
  const [curProjectPath, setCurProjectPath] = useState('');

  useEffect(() => {
    if (curProject) {
      setCurProjectPath(curProject.projectPath);
    }
  }, [curProject]);

  useEffect(() => {
    const updateChatId = () => {
      setCurrentChatId('');
      setMessages([]); // Clear messages for new chat
    };

    // Only add event listener when we want to create a new chat
    if (!chatId) {
      window.addEventListener('newchat', updateChatId);
    }

    // Cleanup
    return () => {
      window.removeEventListener('newchat', updateChatId);
    };
  }, [chatId, setMessages]);

  // Update currentChatId when chatId prop changes
  useEffect(() => {
    setCurrentChatId(chatId);
  }, [chatId]);

  const [saveMessage] = useMutation(SAVE_MESSAGE);

  const [createChat] = useMutation(CREATE_CHAT, {
    onCompleted: async (data) => {
      const newChatId = data.createChat.id;
      setCurrentChatId(newChatId);
      await handleChatResponse(newChatId, input, pendingImagesRef.current);
      window.history.pushState({}, '', `/chat?id=${newChatId}`);
      logger.info(`new chat: ${newChatId}`);
    },
    onError: () => {
      toast.error('Failed to create chat');
      setLoadingSubmit(false);
    },
  });

  const handleChatResponse = async (
    targetChatId: string,
    message: string,
    images?: string[]
  ) => {
    const replyId = `${targetChatId}-${Date.now()}`;
    try {
      setInput('');
      const userInput: ChatInputType = {
        chatId: targetChatId,
        message,
        model: selectedModel,
        role: 'user',
      };
      saveMessage({
        variables: {
          input: userInput as ChatInputType,
        },
      });

      // The agent loop runs on the backend, against the project's real files.
      // The bubble appears with the first text delta rather than up front, so a
      // failed turn does not leave an empty message behind.
      const appendText = (delta: string) =>
        setMessages((prev) =>
          prev.some((m) => m.id === replyId)
            ? prev.map((m) =>
                m.id === replyId ? { ...m, content: m.content + delta } : m
              )
            : [
                ...prev,
                {
                  id: replyId,
                  role: 'assistant',
                  content: delta,
                  createdAt: new Date().toISOString(),
                },
              ]
        );

      let touchedFiles = false;

      // Wire the controller the stop button aborts. Hanging up the response is
      // what actually halts the agent server-side.
      const controller = new AbortController();
      abortRef.current = controller;

      const reply = await startChatStream(userInput, token, {
        signal: controller.signal,
        images,
        onText: appendText,
        // `activity` drives the "what is it doing right now" line while the
        // turn streams, so a long tool run is not a blank wait.
        onTool: (tool, target) => {
          // The agent stream carries no file-change parts, so a write is
          // inferred from the tool that ran.
          if (/edit|write|create|delete/i.test(tool)) touchedFiles = true;
          setActivity({ tool, file: target });
        },
        onError: (m) => toast.error(m),
      });

      setActivity(null);

      if (!reply.trim()) return;

      await saveMessage({
        variables: {
          input: {
            chatId: targetChatId,
            message: reply,
            model: selectedModel,
            role: 'assistant',
          } as ChatInputType,
        },
      });

      // Only re-read the project when the agent actually wrote something.
      if (touchedFiles) await refreshProjects();
    } catch (err) {
      toast.error('Failed to get chat response' + err);
    } finally {
      abortRef.current = null;
      setActivity(null);
      setLoadingSubmit(false);
    }
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
    images?: string[]
  ) => {
    e.preventDefault();
    pendingImagesRef.current = images;

    const content = input;

    if (!content.trim() || loadingSubmit) return;

    setLoadingSubmit(true);

    const messageId = currentChatId || 'temp-id';
    const newMessage: Message = {
      id: messageId,
      role: 'user',
      content: content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMessage]);

    if (!currentChatId) {
      try {
        await createChat({
          variables: {
            input: {
              title: content.slice(0, 50),
            },
          },
        });
      } catch (error) {
        setLoadingSubmit(false);
        return;
      }
    } else {
      await handleChatResponse(currentChatId, content, images);
    }
  };

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    [setInput]
  );

  // Aborting the request closes the response; the backend sees the hang-up and
  // stops the agent, so this is a real stop rather than just hiding the spinner.
  const stop = useCallback(() => {
    if (!loadingSubmit) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setActivity(null);
    setLoadingSubmit(false);
    toast.info('Stopped');
  }, [loadingSubmit]);

  return {
    loadingSubmit,
    activity,
    handleSubmit,
    handleInputChange,
    stop,
    isStreaming: loadingSubmit,
    currentChatId,
    startChatStream,
  };
};
