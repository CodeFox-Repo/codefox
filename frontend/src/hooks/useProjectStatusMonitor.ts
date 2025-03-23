import { useEffect, useState } from 'react';
import { useLazyQuery } from '@apollo/client';
import { GET_CHAT_DETAILS } from '@/graphql/request';
import { logger } from '@/app/log/logger';

interface ProjectStatus {
  isReady: boolean;
  projectId?: string;
  projectName?: string;
  error?: string;
}

/**
 * Separate the logic to monitor the project status from the component, origin code from {@link ProjectProvider}
 * @param chatId chatId
 * @returns return ProjectStatus object
 */
export function useProjectStatusMonitor(chatId: string): ProjectStatus {
  const [isReady, setIsReady] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const [getChatDetails, { loading }] = useLazyQuery(GET_CHAT_DETAILS, {
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      if (data?.getChatDetails?.project) {
        setIsReady(true);
        setProjectId(data.getChatDetails.project.id);
        setProjectName(data.getChatDetails.project.projectName);
      }
    },
    onError: (err) => {
      setError(`Error checking project status: ${err.message}`);
    },
  });

  useEffect(() => {
    if (!chatId) return;

    // eslint-disable-next-line prefer-const
    let pollingInterval: NodeJS.Timeout;
    let attemptCount = 0;
    const MAX_ATTEMPTS = 60; // About 2 minutes of polling

    const checkProjectStatus = async () => {
      attemptCount++;

      try {
        await getChatDetails({
          variables: { chatId },
        });
      } catch (err) {
        logger.error('Error polling for project:', err);
      }

      // Stop polling if project is ready or max attempts reached
      if (isReady || attemptCount >= MAX_ATTEMPTS) {
        clearInterval(pollingInterval);

        if (attemptCount >= MAX_ATTEMPTS && !isReady) {
          setError(
            'Project creation is taking longer than expected. Please check back later.'
          );
        }
      }
    };

    // Check immediately once
    checkProjectStatus();

    // Setup polling interval (check every 6 seconds)
    pollingInterval = setInterval(checkProjectStatus, 6000);

    // Cleanup function
    return () => {
      clearInterval(pollingInterval);
    };
  }, [chatId, getChatDetails, isReady]);

  return { isReady, projectId, projectName, error };
}
