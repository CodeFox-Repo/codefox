import React, {
  createContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import {
  CREATE_PROJECT,
  FORK_PROJECT,
  GET_CHAT_DETAILS,
  GET_USER_PROJECTS,
  UPDATE_PROJECT_PUBLIC_STATUS,
  UPDATE_PROJECT_PHOTO_URL,
} from '@/graphql/request';
import { Project } from '../project-modal';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthContext } from '@/providers/AuthProvider';
import { URL_PROTOCOL_PREFIX } from '@/utils/const';
import { logger } from '@/app/log/logger';

export interface ProjectContextType {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  curProject: Project | undefined;
  setCurProject: React.Dispatch<React.SetStateAction<Project | undefined>>;
  projectLoading: boolean;
  filePath: string | null;
  setFilePath: React.Dispatch<React.SetStateAction<string | null>>;
  createNewProject: (projectName: string, description: string) => Promise<void>;
  createProjectFromPrompt: (
    prompt: string,
    isPublic: boolean,
    model?: string
  ) => Promise<string | false>;
  forkProject: (projectId: string) => Promise<void>;
  setProjectPublicStatus: (
    projectId: string,
    isPublic: boolean
  ) => Promise<void>;
  pollChatProject: (chatId: string) => Promise<Project | null>;
  isLoading: boolean;
  getWebUrl: (
    projectPath: string
  ) => Promise<{ domain: string; containerId: string }>;
  takeProjectScreenshot: (projectId: string, url: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  editorRef?: React.MutableRefObject<any>;
  recentlyCompletedProjectId: string | null;
  setRecentlyCompletedProjectId: (id: string | null) => void;
  chatId: string | null;
  setChatId: (chatId: string | null) => void;
  pendingProjects: Project[];
  setPendingProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  refetchPublicProjects: () => Promise<any>;
  setRefetchPublicProjects: React.Dispatch<
    React.SetStateAction<() => Promise<any>>
  >;
  tempLoadingProjectId: string | null;
  setTempLoadingProjectId: React.Dispatch<React.SetStateAction<string | null>>;
}

export const ProjectContext = createContext<ProjectContextType | undefined>(
  undefined
);

/**
 * Utility function to check if a URL is accessible
 * @param url URL to check
 * @param maxRetries Maximum number of retries
 * @param delayMs Delay between retries in milliseconds
 */
const checkUrlStatus = async (
  url: string,
  maxRetries = 30,
  delayMs = 1000
): Promise<boolean> => {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        // Add shorter timeout to avoid long waits
        signal: AbortSignal.timeout(5000),
      });

      if (res.status === 200) {
        return true;
      }

      logger.info(
        `URL status: ${res.status}. Retry ${retries + 1}/${maxRetries}...`
      );
      retries++;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (err) {
      logger.error('Error checking URL status:', err);
      retries++;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false; // Return false after max retries
};

export function ProjectProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthorized, user } = useAuthContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [curProject, setCurProject] = useState<Project | undefined>(undefined);
  const [projectLoading, setProjectLoading] = useState<boolean>(true);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const editorRef = useRef<any>(null);
  const [pendingProjects, setPendingProjects] = useState<Project[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('pendingProjects');
        if (raw) {
          return JSON.parse(raw) as Project[];
        }
      } catch (e) {
        logger.warn('Failed to parse pendingProjects from localStorage');
      }
    }
    return [];
  });
  const setRecentlyCompletedProjectId = (id: string | null) => {
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('pendingChatId', id);
      } else {
        localStorage.removeItem('pendingChatId');
      }
    }
    setRecentlyCompletedProjectIdRaw(id);
  };

  const [recentlyCompletedProjectIdRaw, setRecentlyCompletedProjectIdRaw] =
    useState<string | null>(() =>
      typeof window !== 'undefined'
        ? localStorage.getItem('pendingChatId')
        : null
    );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('pendingProjects', JSON.stringify(pendingProjects));
    } catch (e) {
      logger.warn('Failed to store pendingProjects in localStorage');
    }
  }, [pendingProjects]);
  // setter：更新 state + localStorage
  const setTempLoadingProjectId = (id: string | null) => {
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('tempLoadingProjectId', id);
      } else {
        localStorage.removeItem('tempLoadingProjectId');
      }
    }
    setTempLoadingProjectIdRaw(id);
  };
  const [chatId, setChatId] = useState<string | null>(null);
  const [pollTime, setPollTime] = useState(Date.now());
  const [isCreateButtonClicked, setIsCreateButtonClicked] = useState(false);
  const [tempLoadingProjectIdRaw, setTempLoadingProjectIdRaw] = useState<
    string | null
  >(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tempLoadingProjectId');
    }
    return null;
  });
  interface ChatProjectCacheEntry {
    project: Project | null;
    timestamp: number;
    retryCount?: number;
  }

  interface ProjectSyncState {
    lastSyncTime: number;
    syncInProgress: boolean;
    lastError?: Error;
  }

  // Use maps with timestamps for better cache management
  const chatProjectCache = useRef<Map<string, ChatProjectCacheEntry>>(
    new Map()
  );
  const pendingOperations = useRef<Map<string, boolean>>(new Map());
  const projectSyncState = useRef<ProjectSyncState>({
    lastSyncTime: 0,
    syncInProgress: false,
  });

  const MAX_RETRIES = 30;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL for cache
  const SYNC_DEBOUNCE_TIME = 1000; // 1 second debounce for sync operations
  const [refetchPublicProjects, setRefetchPublicProjects] = useState<
    () => Promise<any>
  >(() => async () => {});
  // Mounted ref to prevent state updates after unmount
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      chatProjectCache.current.clear();
      pendingOperations.current.clear();
    };
  }, []);

  // Function to clean expired cache entries
  const cleanCache = useCallback(() => {
    const now = Date.now();
    for (const [key, value] of chatProjectCache.current.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        chatProjectCache.current.delete(key);
      }
    }
  }, [CACHE_TTL]);

  // Periodically clean the cache
  useEffect(() => {
    const intervalId = setInterval(cleanCache, 60000); // Clean every minute
    return () => clearInterval(intervalId);
  }, [cleanCache]);

  // Project state synchronization function
  const syncProjectState = useCallback(async () => {
    if (!isMounted.current || projectSyncState.current.syncInProgress) return;

    const now = Date.now();
    if (now - projectSyncState.current.lastSyncTime < SYNC_DEBOUNCE_TIME) {
      return;
    }

    try {
      projectSyncState.current.syncInProgress = true;
      const lastProjectId = localStorage.getItem('lastProjectId');

      if (projects.length > 0) {
        if (curProject) {
          const updatedProject = projects.find((p) => p.id === curProject.id);
          if (updatedProject) {
            if (JSON.stringify(updatedProject) !== JSON.stringify(curProject)) {
              setCurProject(updatedProject);
              projectSyncState.current.lastSyncTime = now;
            }
          } else {
            const fallbackProject = lastProjectId
              ? projects.find((p) => p.id === lastProjectId)
              : projects[0];
            if (fallbackProject) {
              setCurProject(fallbackProject);
              projectSyncState.current.lastSyncTime = now;
            }
          }
        } else if (lastProjectId) {
          const savedProject = projects.find((p) => p.id === lastProjectId);
          if (savedProject) {
            setCurProject(savedProject);
            projectSyncState.current.lastSyncTime = now;
          }
        }

        // Persist current project id if valid
        if (curProject?.id && projects.some((p) => p.id === curProject.id)) {
          localStorage.setItem('lastProjectId', curProject.id);
        }
      }
    } catch (error) {
      projectSyncState.current.lastError = error as Error;
      logger.error('Error syncing project state:', error);
    } finally {
      projectSyncState.current.syncInProgress = false;
    }
  }, [projects, curProject]);

  // Enhanced initial loading for projects and curProject
  useEffect(() => {
    if (!isAuthorized) {
      setProjectLoading(false);
      return;
    }

    // Try to get last project ID from localStorage
    const lastProjectId = localStorage.getItem('lastProjectId');

    // Load initial project data
    const loadInitialData = async () => {
      try {
        setProjectLoading(true);
        const result = await refetch();

        if (result.data?.getUserProjects) {
          const projectsList = result.data.getUserProjects;
          setProjects(projectsList);

          // Find last active project if exists
          if (lastProjectId) {
            const savedProject = projectsList.find(
              (p) => p.id === lastProjectId
            );
            if (savedProject) {
              setCurProject(savedProject);
              // If we're on a specific project page, ensure localStorage is updated
              const urlParams = new URLSearchParams(window.location.search);
              const urlProjectId = urlParams.get('id');
              if (urlProjectId && urlProjectId !== lastProjectId) {
                const urlProject = projectsList.find(
                  (p) => p.id === urlProjectId
                );
                if (urlProject) {
                  setCurProject(urlProject);
                  localStorage.setItem('lastProjectId', urlProjectId);
                }
              }
            } else if (projectsList.length > 0) {
              // Fallback to first project if saved project not found
              setCurProject(projectsList[0]);
              localStorage.setItem('lastProjectId', projectsList[0].id);
            }
          } else if (projectsList.length > 0) {
            // No last project, set to first if available
            setCurProject(projectsList[0]);
            localStorage.setItem('lastProjectId', projectsList[0].id);
          }
        }
      } catch (error) {
        logger.error('Error loading initial project data:', error);
        toast.error('Failed to load projects. Please refresh the page.');
      } finally {
        setProjectLoading(false);
      }
    };

    loadInitialData();
  }, [isAuthorized]);
  useEffect(() => {
    const valid = pendingProjects.filter((p) => !p.projectPath);
    if (valid.length !== pendingProjects.length) {
      setPendingProjects(valid);
    }
  }, [pendingProjects]);

  // Initialization and update effects
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (isMounted.current && !projectSyncState.current.syncInProgress) {
        syncProjectState();
      }
    }, 30000); // Sync every 30 seconds

    return () => clearInterval(syncInterval);
  }, [syncProjectState]);

  // Check URL for project ID on navigation/initial load
  useEffect(() => {
    if (!isAuthorized || projectLoading || projects.length === 0) return;

    const checkUrlForProject = () => {
      try {
        // Get project ID from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('id');

        if (urlProjectId) {
          const urlProject = projects.find((p) => p.id === urlProjectId);
          if (urlProject && (!curProject || curProject.id !== urlProjectId)) {
            setCurProject(urlProject);
            localStorage.setItem('lastProjectId', urlProjectId);
          }
        }
      } catch (error) {
        logger.error('Error checking URL for project:', error);
      }
    };

    checkUrlForProject();
    // Listen for route changes
    window.addEventListener('popstate', checkUrlForProject);

    return () => {
      window.removeEventListener('popstate', checkUrlForProject);
    };
  }, [isAuthorized, projectLoading, projects, curProject]);

  // Persist current project id with validation
  useEffect(() => {
    if (curProject?.id && projects.some((p) => p.id === curProject.id)) {
      localStorage.setItem('lastProjectId', curProject.id);
    }
  }, [curProject?.id, projects]);

  // Project data fetching with sync
  const { refetch } = useQuery(GET_USER_PROJECTS, {
    fetchPolicy: 'network-only',
    skip: !isAuthorized,
    onCompleted: (data) => {
      if (!isMounted.current) return;

      setProjects([...data.getUserProjects]);

      // Trigger state sync after data update
      const now = Date.now();
      if (now - projectSyncState.current.lastSyncTime >= SYNC_DEBOUNCE_TIME) {
        syncProjectState().catch((error) => {
          logger.error('Error during project sync:', error);
          projectSyncState.current.lastError = error as Error;
        });
      }
    },
    onError: (error) => {
      logger.error('Error fetching projects:', error);
      projectSyncState.current.lastError = error;

      if (isMounted.current) {
        toast.error('Failed to fetch projects. Retrying...');
        setTimeout(async () => {
          if (isMounted.current && !projectSyncState.current.syncInProgress) {
            try {
              await refetch();
            } catch (retryError) {
              logger.error('Retry failed:', retryError);
            }
          }
        }, 5000);
      }
    },
  });

  // Enhanced refresh function with sync and error handling
  const refreshProjects = useCallback(async () => {
    if (projectSyncState.current.syncInProgress) {
      logger.debug('Refresh skipped - sync in progress');
      return;
    }

    try {
      projectSyncState.current.syncInProgress = true;
      await refetch();

      // Reset error state on successful refresh
      projectSyncState.current.lastError = undefined;

      // Trigger state sync if enough time has passed
      const now = Date.now();
      if (now - projectSyncState.current.lastSyncTime >= SYNC_DEBOUNCE_TIME) {
        await syncProjectState();
      }
    } catch (error) {
      logger.error('Error refreshing projects:', error);
      if (isMounted.current) {
        projectSyncState.current.lastError = error as Error;
        toast.error('Failed to refresh projects');
      }
    } finally {
      projectSyncState.current.syncInProgress = false;
    }
  }, [refetch, syncProjectState, SYNC_DEBOUNCE_TIME]);

  // Auto-refresh setup
  useEffect(() => {
    if (!isAuthorized) return;

    const refreshInterval = setInterval(() => {
      if (isMounted.current && !projectSyncState.current.syncInProgress) {
        refreshProjects().catch((error) => {
          logger.error('Auto-refresh failed:', error);
        });
      }
    }, 60000); // Auto-refresh every minute

    return () => clearInterval(refreshInterval);
  }, [refreshProjects, isAuthorized]);

  // Create project mutation
  const [createProject] = useMutation(CREATE_PROJECT, {
    onCompleted: (data) => {
      if (!isMounted.current) return;
    },
    onError: (error) => {
      if (isMounted.current) {
        toast.error(`Failed to create project: ${error.message}`);
      }
    },
  });

  // Fork project mutation
  const [forkProjectMutation] = useMutation(FORK_PROJECT, {
    onCompleted: (data) => {
      if (!isMounted.current) return;

      if (data?.forkProject?.id) {
        toast.success('Project forked successfully!');
        router.push(`/chat/${data.forkProject.id}`);

        // Refresh the projects list
        refreshProjects();
      }
    },
    onError: (error) => {
      if (isMounted.current) {
        toast.error(`Failed to fork project: ${error.message}`);
      }
    },
  });

  // Update project public status mutation
  const [updateProjectPublicStatusMutation] = useMutation(
    UPDATE_PROJECT_PUBLIC_STATUS,
    {
      onCompleted: (data) => {
        if (!isMounted.current) return;

        toast.success(
          `Project visibility updated to ${data.updateProjectPublicStatus.isPublic ? 'public' : 'private'}`
        );

        // Update the project in the local state
        setProjects((prev) =>
          prev.map((project) =>
            project.id === data.updateProjectPublicStatus.id
              ? {
                  ...project,
                  isPublic: data.updateProjectPublicStatus.isPublic,
                }
              : project
          )
        );

        // Update current project if it's the one being modified
        if (curProject?.id === data.updateProjectPublicStatus.id) {
          setCurProject((prev) =>
            prev
              ? {
                  ...prev,
                  isPublic: data.updateProjectPublicStatus.isPublic,
                }
              : prev
          );
        }
      },
      onError: (error) => {
        if (isMounted.current) {
          toast.error(`Failed to update project visibility: ${error.message}`);
        }
      },
    }
  );

  const [updateProjectPhotoMutation] = useMutation(UPDATE_PROJECT_PHOTO_URL, {
    onCompleted: (data) => {
      if (!isMounted.current) return;

      // Update projects list
      setProjects((prev) =>
        prev.map((project) =>
          project.id === data.updateProjectPhoto.id
            ? {
                ...project,
                photoUrl: data.updateProjectPhoto.photoUrl,
              }
            : project
        )
      );

      // Update current project if it's the one being modified
      if (curProject?.id === data.updateProjectPhoto.id) {
        setCurProject((prev) =>
          prev
            ? {
                ...prev,
                photoUrl: data.updateProjectPhoto.photoUrl,
              }
            : prev
        );
      }
    },
    onError: (error) => {
      if (isMounted.current) {
        toast.error(`Failed to update project photo: ${error.message}`);
      }
    },
  });

  const takeProjectScreenshot = useCallback(
    async (projectId: string, url: string): Promise<void> => {
      // Check if this screenshot operation is already in progress
      const operationKey = `screenshot_${projectId}`;
      if (pendingOperations.current.get(operationKey)) {
        return;
      }

      pendingOperations.current.set(operationKey, true);

      try {
        // Check if the URL is accessible
        const isUrlAccessible = await checkUrlStatus(url);
        if (!isUrlAccessible) {
          logger.warn(`URL ${url} is not accessible after multiple retries`);
          return;
        }

        // Add a cache buster to avoid previous screenshot caching
        const screenshotUrl = `/api/screenshot?url=${encodeURIComponent(url)}&t=${Date.now()}`;
        const screenshotResponse = await fetch(screenshotUrl);

        if (!screenshotResponse.ok) {
          throw new Error(
            `Failed to capture screenshot: ${screenshotResponse.status} ${screenshotResponse.statusText}`
          );
        }

        const arrayBuffer = await screenshotResponse.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'image/png' });
        const file = new File([blob], 'screenshot.png', { type: 'image/png' });

        await updateProjectPhotoMutation({
          variables: {
            input: {
              projectId,
              file,
            },
          },
        });
      } catch (error) {
        logger.error('Error taking screenshot:', error);
      } finally {
        pendingOperations.current.delete(operationKey);
      }
    },
    [updateProjectPhotoMutation]
  );

  const getWebUrl = useCallback(
    async (
      projectPath: string
    ): Promise<{ domain: string; containerId: string }> => {
      // Check if this operation is already in progress
      const operationKey = `getWebUrl_${projectPath}`;
      if (pendingOperations.current.get(operationKey)) {
        // Wait for operation to complete
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (!pendingOperations.current.get(operationKey)) {
              clearInterval(checkInterval);
              resolve(true);
            }
          }, 500);
        });
      }

      pendingOperations.current.set(operationKey, true);

      try {
        const response = await fetch(
          `/api/runProject?projectPath=${encodeURIComponent(projectPath)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to get web URL: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();

        if (!data.domain || !data.containerId) {
          throw new Error(
            'Invalid response from API: missing domain or containerId'
          );
        }

        const baseUrl = `${URL_PROTOCOL_PREFIX}://${data.domain}`;

        // Find project and take screenshot if needed
        const project = projects.find((p) => p.projectPath === projectPath);
        if (project) {
          // Don't await this - let it run in background
          takeProjectScreenshot(project.id, baseUrl).catch((err) =>
            logger.error('Background screenshot error:', err)
          );
        }

        return {
          domain: data.domain,
          containerId: data.containerId,
        };
      } catch (error) {
        logger.error('Error getting web URL:', error);
        if (isMounted.current) {
          toast.error('Failed to prepare web preview');
        }
        throw error;
      } finally {
        pendingOperations.current.delete(operationKey);
      }
    },
    [projects, takeProjectScreenshot]
  );

  const [getChatDetail] = useLazyQuery(GET_CHAT_DETAILS, {
    fetchPolicy: 'network-only',
  });

  // Original createNewProject function
  const createNewProject = useCallback(
    async (projectName: string, description: string): Promise<void> => {
      if (!projectName || !description) {
        if (isMounted.current) {
          toast.error('Please fill in all fields!');
        }
        return;
      }

      try {
        if (isMounted.current) {
          setIsLoading(true);
        }

        await createProject({
          variables: {
            createProjectInput: {
              projectName,
              description,
              databaseType: 'MySQL',
              packages: [],
              public: false, // Default to private
            },
          },
        });
      } catch (err) {
        logger.error('Failed to create project:', err);
        if (isMounted.current) {
          toast.error('An error occurred while creating the project');
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    },
    [createProject]
  );

  // New function to create project from prompt
  const createProjectFromPrompt = useCallback(
    async (
      prompt: string,
      isPublic: boolean,
      model = 'gpt-4o-mini'
    ): Promise<string> => {
      if (!prompt.trim()) {
        toast.error('Please enter a project description');
        throw new Error('Invalid prompt');
      }

      try {
        setIsLoading(true);

        const defaultPackages = [
          { name: 'react', version: '^18.2.0' },
          { name: 'next', version: '^13.4.0' },
          { name: 'tailwindcss', version: '^3.3.0' },
        ];

        const result = await createProject({
          variables: {
            createProjectInput: {
              description: prompt,
              packages: defaultPackages,
              public: isPublic,
              model,
            },
          },
        });

        const createdChat = result.data?.createProject;
        if (createdChat?.id) {
          setChatId(createdChat.id);
          setIsCreateButtonClicked(true);
          localStorage.setItem('pendingChatId', createdChat.id);
          setTempLoadingProjectId(createdChat.id);
          return createdChat.id;
        } else {
          throw new Error('Project creation failed: no chatId');
        }
      } catch (error) {
        toast.error('Failed to create project from prompt');
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [createProject, setChatId, user]
  );

  // New function to fork a project
  const forkProject = useCallback(
    async (projectId: string): Promise<void> => {
      try {
        if (isMounted.current) {
          setIsLoading(true);
        }

        await forkProjectMutation({
          variables: {
            projectId,
          },
        });
      } catch (error) {
        logger.error('Error forking project:', error);
        if (isMounted.current) {
          toast.error('Failed to fork project');
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    },
    [forkProjectMutation]
  );

  // Function to update project public status
  const setProjectPublicStatus = useCallback(
    async (projectId: string, isPublic: boolean): Promise<void> => {
      const operationKey = `publicStatus_${projectId}`;
      if (pendingOperations.current.get(operationKey)) {
        return;
      }

      pendingOperations.current.set(operationKey, true);

      try {
        await updateProjectPublicStatusMutation({
          variables: {
            projectId,
            isPublic,
          },
        });
      } catch (error) {
        logger.error('Error updating project visibility:', error);
        if (isMounted.current) {
          toast.error('Failed to update project visibility');
        }
      } finally {
        pendingOperations.current.delete(operationKey);
      }
    },
    [updateProjectPublicStatusMutation]
  );

  const pollChatProject = useCallback(
    async (chatId: string): Promise<Project | null> => {
      // Check cache first (with validity)
      const cachedData = chatProjectCache.current.get(chatId);
      if (cachedData) {
        const now = Date.now();
        if (now - cachedData.timestamp < CACHE_TTL) {
          return cachedData.project;
        }
      }

      // Check if this poll operation is already in progress
      const operationKey = `poll_${chatId}`;
      if (pendingOperations.current.get(operationKey)) {
        // Wait for any pending operation to complete
        let retries = 0;
        while (pendingOperations.current.get(operationKey) && retries < 10) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          retries++;
        }

        const currentTime = Date.now();
        const updatedCache = chatProjectCache.current.get(chatId);
        if (updatedCache && currentTime - updatedCache.timestamp < CACHE_TTL) {
          return updatedCache.project;
        }
      }

      if (projectSyncState.current.syncInProgress) {
        logger.debug('Poll skipped - sync in progress');
        return cachedData?.project ?? null;
      }

      pendingOperations.current.set(operationKey, true);
      let retries = 0;

      try {
        while (retries < MAX_RETRIES) {
          try {
            const { data } = await getChatDetail({ variables: { chatId } });

            if (data?.getChatDetails?.project) {
              const project = data.getChatDetails.project;
              const now = Date.now();

              // Update cache with timestamp and retry count
              chatProjectCache.current.set(chatId, {
                project,
                timestamp: now,
                retryCount: retries,
              });

              // First update the project list to ensure it exists in allProjects
              setProjects((prev) => {
                const exists = prev.find((p) => p.id === project.id);
                return exists ? prev : [...prev, project];
              });

              // Then more aggressively clean up pending projects
              setPendingProjects((prev) => {
                const filtered = prev.filter((p) => p.id !== project.id);
                if (filtered.length !== prev.length) {
                  logger.info(
                    `Removed project ${project.id} from pending projects`
                  );
                }
                return filtered;
              });

              // Then trigger the public projects refetch
              await refetchPublicProjects();
              console.log(
                '[pollChatProject] refetchPublicProjects triggered after project is ready:',
                project.id
              );

              // Trigger state sync if needed
              if (
                now - projectSyncState.current.lastSyncTime >=
                SYNC_DEBOUNCE_TIME
              ) {
                syncProjectState().catch((error) => {
                  logger.warn('Background sync failed:', error);
                });
              }

              // Try to get web URL in background
              if (isMounted.current && project.projectPath) {
                setCurProject(project);
                localStorage.setItem('lastProjectId', project.id);
                getWebUrl(project.projectPath)
                  .then(({ domain }) => {
                    const baseUrl = `${URL_PROTOCOL_PREFIX}://${domain}`;
                    takeProjectScreenshot(project.id, baseUrl);
                  })
                  .catch((error) => {
                    logger.warn('Background web URL fetch failed:', error);
                  });
              }

              if (isMounted.current) {
                setTempLoadingProjectId(null);
              }
              return project;
            }
          } catch (error) {
            logger.error(
              `Error polling chat (attempt ${retries + 1}/${MAX_RETRIES}):`,
              error
            );
            projectSyncState.current.lastError = error as Error;
          }

          if (!isMounted.current) return null;
          await new Promise((resolve) => setTimeout(resolve, 6000));
          retries++;
        }

        // Cache the null result with retry info
        chatProjectCache.current.set(chatId, {
          project: null,
          timestamp: Date.now(),
          retryCount: retries,
        });

        return null;
      } finally {
        pendingOperations.current.delete(operationKey);
      }
    },
    [
      getChatDetail,
      getWebUrl,
      syncProjectState,
      MAX_RETRIES,
      CACHE_TTL,
      SYNC_DEBOUNCE_TIME,
      refetchPublicProjects,
    ]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setPollTime(Date.now()); // 每6秒更新时间，触发下面的 useEffect
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  // Poll project data every 5 seconds
  useEffect(() => {
    if (!chatId) return;

    const fetch = async () => {
      try {
        await pollChatProject(chatId);
      } catch (error) {
        logger.error('Polling error:', error);
      }
    };

    fetch();
  }, [pollTime, chatId, isCreateButtonClicked, pollChatProject]);
  const contextValue = useMemo(
    () => ({
      projects,
      setProjects,
      curProject,
      setCurProject,
      projectLoading,
      filePath,
      setFilePath,
      createNewProject,
      createProjectFromPrompt,
      forkProject,
      setProjectPublicStatus,
      pollChatProject,
      isLoading,
      getWebUrl,
      takeProjectScreenshot,
      refreshProjects,
      editorRef,
      chatId,
      setChatId,
      recentlyCompletedProjectId: recentlyCompletedProjectIdRaw,
      setRecentlyCompletedProjectId,
      pendingProjects,
      setPendingProjects,
      refetchPublicProjects,
      setRefetchPublicProjects,
      tempLoadingProjectId: tempLoadingProjectIdRaw,
      setTempLoadingProjectId,
    }),
    [
      projects,
      curProject,
      projectLoading,
      filePath,
      createNewProject,
      createProjectFromPrompt,
      forkProject,
      setProjectPublicStatus,
      pollChatProject,
      isLoading,
      getWebUrl,
      takeProjectScreenshot,
      refreshProjects,
      editorRef,
      chatId,
      setChatId,
      recentlyCompletedProjectIdRaw,
      pendingProjects,
      setPendingProjects,
      refetchPublicProjects,
      setRefetchPublicProjects,
      tempLoadingProjectIdRaw,
      setTempLoadingProjectId,
    ]
  );

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}
