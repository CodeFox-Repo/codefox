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
import { managerAgent } from './multi-agent/managerAgent';

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

  // Use useEffect to handle new chat event and cleanup
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

      const tempId = `${targetChatId}-${Date.now()}`;

      await managerAgent(
        tempId,
        userInput,
        setMessages,
        curProjectPath,
        saveMessage,
        token,
        refreshProjects,
        setFilePath,
        editorRef,
        setThinkingProcess,
        setIsTPUpdating,
        setLoadingSubmit
      );
    } catch (err) {
      toast.error('Failed to get chat response' + err);
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
      console.log('currentChatId: ' + currentChatId);
      console.log('Creating new chat...');
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
