import { useState, useCallback, useEffect, useContext, useRef } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_CHAT, SAVE_MESSAGE } from '@/graphql/request';
import { Message, splitTurn, TurnStep } from '@/const/MessageType';
import { toast } from 'sonner';
import { logger } from '@/app/log/logger';
import { useAuthContext } from '@/providers/AuthProvider';
import { startChatStream, type LintFinding } from '@/api/ChatStreamAPI';
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
  /** What the last turn's page got wrong. Replaced per turn, not appended:
   *  the agent may well have fixed the previous set, and a stale finding is
   *  worse than none. */
  const [lint, setLint] = useState<LintFinding[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  /** Attachments for the turn being submitted. A ref because the first turn of
   *  a new chat is dispatched from createChat's onCompleted, outside the
   *  handleSubmit closure. */
  const pendingImagesRef = useRef<string[] | undefined>(undefined);
  const [currentChatId, setCurrentChatId] = useState<string>(chatId);
  const { token } = useAuthContext();
  const { curProject, refreshProjects, setFilePath, editorRef, turnFinished } =
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
    images?: string[],
    // The first turn of a project chat arrives with its user message already
    // stored server-side (createProject saves it); re-saving would double it.
    saveUser = true,
    // The chat's own stored model. State-held selectedModel lags one render
    // behind, so the auto-started first turn passes this directly.
    model?: string
  ) => {
    const replyId = `${targetChatId}-${Date.now()}`;
    // Outside the try so the catch can tell "failed before anything streamed"
    // (safe to retry) from "died mid-turn" (retrying would rerun real work).
    const steps: TurnStep[] = [];
    try {
      setInput('');
      const userInput: ChatInputType = {
        chatId: targetChatId,
        message,
        model: model ?? selectedModel,
        role: 'user',
      };
      if (saveUser) {
        saveMessage({
          variables: {
            input: userInput as ChatInputType,
          },
        });
      }

      // The agent loop runs on the backend, against the project's real files.
      // The bubble appears with the first text delta rather than up front, so a
      // failed turn does not leave an empty message behind.
      // The turn is built as steps, not as one growing string: the agent
      // narrates, runs a tool, narrates again, and only its last words are the
      // answer. `content` still holds the joined text so everything that reads
      // a message as plain text keeps working.
      const flush = () =>
        setMessages((prev) => {
          const next: Message = {
            id: replyId,
            role: 'assistant',
            content: steps
              .filter(
                (s): s is Extract<TurnStep, { kind: 'text' }> =>
                  s.kind === 'text'
              )
              .map((s) => s.text)
              .join(''),
            createdAt: new Date().toISOString(),
            steps: [...steps],
          };
          return prev.some((m) => m.id === replyId)
            ? prev.map((m) => (m.id === replyId ? { ...m, ...next } : m))
            : [...prev, next];
        });

      const appendText = (delta: string) => {
        const last = steps[steps.length - 1];
        if (last?.kind === 'text') last.text += delta;
        else steps.push({ kind: 'text', text: delta });
        flush();
      };

      let touchedFiles = false;

      // Cleared here rather than on the event: a clean turn sends no lint
      // event at all, so findings the agent has since fixed would otherwise
      // stay on screen forever.
      setLint([]);

      // Wire the controller the stop button aborts. Hanging up the response is
      // what actually halts the agent server-side.
      const controller = new AbortController();
      abortRef.current = controller;

      // The joined text it returns is no longer what gets saved; the
      // structured steps are, so the answer can be told apart from the notes.
      await startChatStream(userInput, token, {
        signal: controller.signal,
        images,
        onText: appendText,
        // `activity` drives the "what is it doing right now" line while the
        // turn streams, so a long tool run is not a blank wait.
        onTool: (tool, target) => {
          // The agent stream carries no file-change parts, so a write is
          // inferred from the tool that ran.
          if (/edit|write|create|delete/i.test(tool)) touchedFiles = true;
          steps.push({ kind: 'tool', tool, file: target });
          flush();
          setActivity({ tool, file: target });
        },
        onError: (m) => toast.error(m),
        onLint: setLint,
      });

      setActivity(null);

      // Here rather than beside refreshProjects below: that sits after an
      // awaited saveMessage and behind an early `return` for an empty answer,
      // so the file panels stayed stale for a whole round trip — or forever,
      // on a turn that edited files but said nothing. This also lands in the
      // same commit as the lint findings above, so the Changes list and its
      // findings repaint together instead of tearing.
      if (touchedFiles) turnFinished();

      // Only the answer is kept. The working notes exist to be watched while
      // the turn runs; storing them would replay "let me check X…" forever on
      // every reload, where there is no longer anything to fold them into.
      const answer = splitTurn(steps)
        .answer.map((s) => (s.kind === 'text' ? s.text : ''))
        .join('')
        .trim();

      if (!answer) return;

      await saveMessage({
        variables: {
          input: {
            chatId: targetChatId,
            message: answer,
            model: model ?? selectedModel,
            role: 'assistant',
            // Kept with the message so reloading a chat can fold the work
            // back open instead of showing the answer with no history.
            steps,
          } as ChatInputType,
        },
      });

      // Only re-read the project when the agent actually wrote something.
      if (touchedFiles) await refreshProjects();
    } catch (err) {
      // An auto-started first turn that died before producing anything is the
      // caller's to retry — right after creation the backend may still be
      // provisioning the project's sandbox and rejects the turn outright.
      if (!saveUser && steps.length === 0) throw err;
      // An abort is the user's own stop, not a failure to report.
      if ((err as Error)?.name !== 'AbortError') {
        toast.error('The agent hit an error mid-reply — try sending again.');
        logger.error('turn failed:', err);
      }
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

  /**
   * Run a turn for a message that is already saved — the project-creation
   * flow stores the prompt server-side and navigates here, so nothing ever
   * submitted it. The chat page calls this once the project is bound.
   * Rejects if the turn failed before anything streamed, so the caller can
   * retry while the backend finishes provisioning the project.
   */
  const startTurn = async (
    targetChatId: string,
    message: string,
    model?: string
  ) => {
    if (loadingSubmit) return;
    setLoadingSubmit(true);
    await handleChatResponse(targetChatId, message, undefined, false, model);
  };

  /**
   * Send a message that was composed by the UI rather than typed — the
   * planner's answered question card. Saved and run like a typed turn.
   */
  const sendMessage = async (text: string) => {
    if (loadingSubmit || !currentChatId || !text.trim()) return;
    setLoadingSubmit(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `${currentChatId}-${Date.now()}-q`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
    await handleChatResponse(currentChatId, text);
  };

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    [setInput]
  );

  // Steering: the composer stays live while the agent works. Messages sent
  // mid-turn queue here and go out as the next turn the moment the stream
  // ends — the harness has no mid-turn injection, so this is the honest
  // version of "keep talking while it builds".
  const [queued, setQueued] = useState<string[]>([]);
  const queueMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    setQueued((prev) => [...prev, text.trim()]);
  }, []);
  const clearQueued = useCallback(() => setQueued([]), []);
  useEffect(() => {
    if (loadingSubmit || queued.length === 0) return;
    const text = queued.join('\n\n');
    setQueued([]);
    sendMessage(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingSubmit, queued]);

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
    lint,
    handleSubmit,
    handleInputChange,
    startTurn,
    sendMessage,
    stop,
    queued,
    queueMessage,
    clearQueued,
    isStreaming: loadingSubmit,
    currentChatId,
    startChatStream,
  };
};
