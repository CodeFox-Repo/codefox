'use client';

import { useContext, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ProjectContext } from './chat/code-engine/project-context';
import { logger } from '@/app/log/logger';
import { ProjectReadyToast } from './project-ready-toast';
import { URL_PROTOCOL_PREFIX } from '@/utils/const';

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
    getWebUrl,
    takeProjectScreenshot,
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
          await refetchPublicProjects();
          setTempLoadingProjectId(null);

          // Make sure it's for project screenshot
          try {
            if (project.id && project.projectPath) {
              logger.info(
                `[PROJECT_POLLER] Taking screenshot for project ${project.id}`
              );
              // Get project URL and take screenshot
              const { domain, port } = await getWebUrl(project.projectPath);

              // Access directly using port
              let baseUrl;
              if (port) {
                baseUrl = `${URL_PROTOCOL_PREFIX}://localhost:${port}`;
                logger.info(
                  `[PROJECT_POLLER] Using localhost URL with port: ${baseUrl}`
                );
              } else {
                baseUrl = `${URL_PROTOCOL_PREFIX}://${domain}`;
                logger.info(`[PROJECT_POLLER] Using domain URL: ${baseUrl}`);
              }

              logger.info(
                `[PROJECT_POLLER] Waiting for service to fully start before taking screenshot`
              );
              await new Promise((resolve) => setTimeout(resolve, 10000)); // Increase wait time to 10 seconds
              logger.info(
                `[PROJECT_POLLER] Wait completed, proceeding with screenshot`
              );

              const result = await takeProjectScreenshot(project.id, baseUrl);
              logger.info(
                `[PROJECT_POLLER] Screenshot taken for project ${project.id}, result: ${JSON.stringify(result)}`
              );
            }
          } catch (screenshotError) {
            logger.error(
              `[PROJECT_POLLER] Error taking project screenshot: ${screenshotError.message}`,
              screenshotError
            );
          }

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
  }, [
    recentlyCompletedProjectId,
    pollChatProject,
    refreshProjects,
    refetchPublicProjects,
    setTempLoadingProjectId,
    getWebUrl,
    takeProjectScreenshot,
    router,
    setChatId,
  ]);

  return null;
};

export default GlobalToastListener;
