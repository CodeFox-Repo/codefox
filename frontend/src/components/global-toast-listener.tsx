'use client';
import { useContext, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ProjectContext } from './chat/code-engine/project-context';
import { logger } from '@/app/log/logger';
import { ProjectReadyToast } from './project-ready-toast';

const GlobalToastListener = () => {
  const {
    recentlyCompletedProjectId,
    setRecentlyCompletedProjectId,
    pollChatProject,
    setChatId,
  } = useContext(ProjectContext);
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // optional: if you use this in your logic
  const setCurrentChatid = (id: string) => {}; // or import your actual setter

  useEffect(() => {
    if (!recentlyCompletedProjectId) return;

    const checkProjectReady = async () => {
      try {
        const project = await pollChatProject(recentlyCompletedProjectId);

        if (project?.projectPath) {
          toast.custom(
            (t) => (
              <ProjectReadyToast
                chatId={recentlyCompletedProjectId}
                close={() => toast.dismiss(t)}
                router={router}
                setCurrentChatid={setCurrentChatid}
                setChatId={setChatId}
              />
            ),
            {
              duration: 30000,
            }
          );

          setRecentlyCompletedProjectId(null);

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          logger.debug('Project not ready yet, will retry...');
        }
      } catch (err) {
        logger.error('Error polling project status:', err);
      }
    };

    intervalRef.current = setInterval(checkProjectReady, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [recentlyCompletedProjectId]);

  return null;
};

export default GlobalToastListener;
