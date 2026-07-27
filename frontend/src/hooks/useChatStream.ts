import { useState, useCallback, useEffect, useContext } from 'react';
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
  setThinkingProcess: React.Dispatch<React.SetStateAction<Message[]>>;
  selectedModel: string;
  setIsTPUpdating: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useChatStream = ({
  chatId,
  input,
  setInput,
  setMessages,
  setThinkingProcess,
  selectedModel,
  setIsTPUpdating,
}: UseChatStreamProps) => {
  const [loadingSubmit, setLoadingSubmit] = useState(false);
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
      await handleChatResponse(newChatId, input);
      window.history.pushState({}, '', `/chat?id=${newChatId}`);
      logger.info(`new chat: ${newChatId}`);
    },
    onError: () => {
      toast.error('Failed to create chat');
      setLoadingSubmit(false);
    },
  });

  const handleChatResponse = async (targetChatId: string, message: string) => {
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
      // The bubble appears with the first delta rather than up front, so a
      // failed turn does not leave an empty message behind.
      const reply = await startChatStream(userInput, token, true, (delta) =>
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
        )
      );

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

      // Files on disk changed underneath the editor — pull the new tree in.
      await refreshProjects();
    } catch (err) {
      toast.error('Failed to get chat response' + err);
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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
      await handleChatResponse(currentChatId, content);
    }
  };

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    [setInput]
  );

  const stop = useCallback(() => {
    if (loadingSubmit) {
      setLoadingSubmit(false);
      toast.info('Message generation stopped');
    }
  }, [loadingSubmit]);

  return {
    loadingSubmit,
    handleSubmit,
    handleInputChange,
    stop,
    isStreaming: loadingSubmit,
    currentChatId,
    startChatStream,
  };
};
