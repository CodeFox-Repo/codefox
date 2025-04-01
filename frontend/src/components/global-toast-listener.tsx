'use client';

import { useContext, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ProjectContext } from './chat/code-engine/project-context';
import { logger } from '@/app/log/logger';
import { ProjectReadyToast } from './project-ready-toast';

const COMPLETED_CACHE_KEY = 'completedChatIds';

const getCompletedFromLocalStorage = (): Set<string> => {
  try {
    const raw = localStorage.getItem(COMPLETED_CACHE_KEY);
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch (e) {
    logger.warn('Failed to read completedChatIds from localStorage');
  }
  return new Set();
};

const saveCompletedToLocalStorage = (set: Set<string>) => {
  try {
    localStorage.setItem(COMPLETED_CACHE_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    logger.warn('Failed to save completedChatIds to localStorage');
  }
};

const GlobalToastListener = () => {
  const {
    recentlyCompletedProjectId,
    setRecentlyCompletedProjectId,
    pollChatProject,
    setChatId,
    refreshProjects,
    refetchPublicProjects,
    setTempLoadingProjectId,
  } = useContext(ProjectContext);
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const completedIdsRef = useRef<Set<string>>(getCompletedFromLocalStorage());

  const setCurrentChatid = (id: string) => {};

  useEffect(() => {
    const chatId = recentlyCompletedProjectId;
    if (!chatId || completedIdsRef.current.has(chatId)) return;

    intervalRef.current = setInterval(async () => {
      try {
        const project = await pollChatProject(chatId);
        if (project?.projectPath) {
          await refreshProjects();
          await refetchPublicProjects(); // 🚀 确保刷新公共项目视图
          setTempLoadingProjectId(null);
          toast.custom(
            (t) => (
              <ProjectReadyToast
                chatId={chatId}
                close={() => toast.dismiss(t)}
                router={router}
                setCurrentChatid={setCurrentChatid}
                setChatId={setChatId}
              />
            ),
            { duration: 10000 }
          );

          completedIdsRef.current.add(chatId);
          saveCompletedToLocalStorage(completedIdsRef.current);
          setRecentlyCompletedProjectId(null);

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          logger.debug(`Chat ${chatId} not ready yet...`);
        }
      } catch (e) {
        logger.error('pollChatProject error:', e);
      }
    }, 6000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [recentlyCompletedProjectId]);

  return null;
};

export default GlobalToastListener;
