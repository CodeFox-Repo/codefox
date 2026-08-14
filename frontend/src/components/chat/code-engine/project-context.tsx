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
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthContext } from '@/providers/AuthProvider';
import { URL_PROTOCOL_PREFIX } from '@/utils/const';
import { logger } from '@/app/log/logger';
import { authenticatedFetch } from '@/lib/authenticatedFetch';

/** Lived in project-modal.tsx until that unreachable modal was removed. */
export interface Project {
  id: string;
  projectName: string;
  projectPath: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  isDeleted: boolean;
  userId: string;
  isPublic?: boolean;
  photoUrl?: string;
  /** 'html' — self-contained pages; 'next' / null — the full starter. */
  template?: string | null;
}

export interface ProjectContextType {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  curProject: Project | undefined;
  setCurProject: React.Dispatch<React.SetStateAction<Project | undefined>>;
  projectLoading: boolean;
  filePath: string | null;
  setFilePath: React.Dispatch<React.SetStateAction<string | null>>;
  /** Resolves to the new chat id, or null when creation failed. */
  createProjectFromPrompt: (
    prompt: string,
    isPublic: boolean,
    model?: string,
    scenario?: string,
    style?: string
  ) => Promise<string | null>;
  /** Resolves to the new chat id so the caller can navigate into the fork. */
  forkProject: (projectId: string) => Promise<string | null>;
  setProjectPublicStatus: (
    projectId: string,
    isPublic: boolean
  ) => Promise<void>;
  pollChatProject: (chatId: string) => Promise<Project | null>;
  isLoading: boolean;
  getWebUrl: (
    projectPath: string
  ) => Promise<{ domain: string; containerId: string }>;
  takeProjectScreenshot: (
    projectId: string,
    url: string,
    projectPath?: string
  ) => Promise<void>;
  refreshProjects: () => Promise<void>;
  /** Bumped once per finished turn. Panels that read the project's files
   *  rather than its GraphQL row watch this to know they went stale. */
  turnsDone: number;
  turnFinished: () => void;
  editorRef?: React.MutableRefObject<any>;
}

export const ProjectContext = createContext<ProjectContextType | undefined>(
  undefined
);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthorized } = useAuthContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [curProject, setCurProject] = useState<Project | undefined>(undefined);
  const [projectLoading, setProjectLoading] = useState<boolean>(true);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const editorRef = useRef<any>(null);
  // Not folded into refreshProjects: that also runs on a 60s timer, and the
  // file panels have nothing to re-read when no turn happened.
  const [turnsDone, setTurnsDone] = useState(0);
  const turnFinished = useCallback(() => setTurnsDone((n) => n + 1), []);

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

  // Deliberately no onCompleted/onError: they fought with the caller. The
  // completion handler navigated to `/chat/<id>`, a route that does not exist
  // (the chat page reads `?id=`), and defining onError stopped Apollo from
  // rejecting, so the caller's own error branch never ran. `forkProject`
  // below owns both outcomes.
  const [forkProjectMutation] = useMutation(FORK_PROJECT);

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
    async (
      projectId: string,
      url: string,
      // Lets the backend shoot the project's own dev server instead of this
      // URL, which is the API origin and shows the preview only to a request
      // holding the preview cookie.
      projectPath?: string
    ): Promise<void> => {
      // Check if this screenshot operation is already in progress
      const operationKey = `screenshot_${projectId}`;
      if (pendingOperations.current.get(operationKey)) {
        return;
      }

      pendingOperations.current.set(operationKey, true);

      try {
        // No client-side reachability probe: it is cross-origin
        // (localhost:3000 -> 127.0.0.1:<port>) so the preflight OPTIONS is
        // rejected and the check never passed — which is why no project ever
        // got a cover image. /api/screenshot runs server-side and reports its
        // own failure below.
        //
        // The backend derives the address from the project itself; passing a
        // URL used to let any caller aim it anywhere the container could
        // reach, so it no longer accepts one.
        if (!projectPath) throw new Error('No project to screenshot');

        // Add a cache buster to avoid previous screenshot caching
        const screenshotUrl = `/api/screenshot?projectPath=${encodeURIComponent(
          projectPath
        )}&t=${Date.now()}`;
        const screenshotResponse = await authenticatedFetch(screenshotUrl);

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
        // Backend-owned: it holds the project directories and the process
        // that serves them. /api/preview proxies through to the backend.
        // Straight to the backend, not through the Next rewrite. The reply
        // sets the cookie that tells the proxy which project to serve, and a
        // server-side rewrite would land that cookie on this origin — while
        // the iframe it is meant for is served from the backend's. Hence also
        // `credentials: include`.
        const backend =
          process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
        const response = await authenticatedFetch(
          `${backend}/api/preview?projectPath=${encodeURIComponent(projectPath)}`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          // The body carries Nest's message — which is the whole diagnosis
          // when a dev server fails to boot ("exited during startup", "did
          // not start in time"). Dropping it is why HANDOFF's "500 after
          // ~2min" has stayed undiagnosed: the status alone says nothing.
          const detail = await response.text().catch(() => '');
          const message =
            (() => {
              try {
                return JSON.parse(detail)?.message;
              } catch {
                return detail.slice(0, 300);
              }
            })() || response.statusText;
          throw new Error(`Preview failed (${response.status}): ${message}`);
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
          takeProjectScreenshot(project.id, baseUrl, projectPath).catch((err) =>
            logger.error('Background screenshot error:', err)
          );
        }

        return {
          domain: data.domain,
          containerId: data.containerId,
        };
      } catch (error) {
        // No toast: while the project is still scaffolding or the dev server
        // is booting this fails by design, and the preview pane shows its own
        // "not ready yet" state and retries. A toast here turned every fresh
        // project into a spurious "preview failed".
        logger.error('Error getting web URL:', error);
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

  // New function to create project from prompt
  const createProjectFromPrompt = useCallback(
    async (
      prompt: string,
      isPublic: boolean,
      // No default: the backend picks LLM_DEFAULT_MODEL, which is the one the
      // configured endpoint actually serves.
      model?: string,
      /** What the user is making; the backend maps it to a workspace kind. */
      scenario?: string,
      /** Design system id for page projects; the backend falls back on its
       *  own for an unknown or missing one. */
      style?: string
    ): Promise<string | null> => {
      if (!prompt.trim()) {
        if (isMounted.current) {
          toast.error('Please enter a project description');
        }
        return null;
      }

      try {
        if (isMounted.current) {
          setIsLoading(true);
        }

        const result = await createProject({
          variables: {
            createProjectInput: {
              description: prompt,
              public: isPublic,
              model: model,
              scenario: scenario,
              style: style,
            },
          },
        });

        return result.data.createProject.id;
      } catch (error) {
        logger.error('Error creating project:', error);
        if (isMounted.current) {
          // Same as fork: the quota refusal names the limit, the current
          // count and the way out. A generic "failed" hides all three.
          const message = (error as Error)?.message ?? '';
          toast.error(
            message.includes('which is the limit of')
              ? message
              : 'Failed to create project from prompt'
          );
        }
        return null;
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    },
    [createProject]
  );

  // New function to fork a project
  const forkProject = useCallback(
    async (projectId: string): Promise<string | null> => {
      try {
        if (isMounted.current) {
          setIsLoading(true);
        }

        // The backend answers with the chat bound to the new project, so the
        // caller can drop the user straight into their copy.
        const result = await forkProjectMutation({
          variables: { projectId },
        });
        await refetch();
        return result.data?.forkProject?.id ?? null;
      } catch (error) {
        logger.error('Error forking project:', error);
        if (isMounted.current) {
          const message = (error as Error)?.message ?? '';
          toast.error(
            message.includes('your own')
              ? 'You already own this project'
              : // The quota message already names the limit, the count and
                // what to do about it — replacing it with "Failed to fork"
                // would throw away the only actionable part.
                message.includes('which is the limit of')
                ? message
                : 'Failed to fork project'
          );
        }
        return null;
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

              // Trigger state sync if needed
              if (
                now - projectSyncState.current.lastSyncTime >=
                SYNC_DEBOUNCE_TIME
              ) {
                syncProjectState().catch((error) => {
                  logger.warn('Background sync failed:', error);
                });
              }

              // Try to get web URL in background. Next apps only: an html
              // project is a file, has no package.json and never gets a dev
              // server, so this asked the backend to boot one for every page
              // project — a 500 per poll, forever, and a red console for a
              // product whose DEFAULT kind is html. The preview pane renders
              // those from the file itself (HtmlPreview).
              if (
                isMounted.current &&
                project.projectPath &&
                project.template !== 'html'
              ) {
                getWebUrl(project.projectPath).catch((error) => {
                  logger.warn('Background web URL fetch failed:', error);
                });
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
    ]
  );

  const contextValue = useMemo(
    () => ({
      projects,
      setProjects,
      curProject,
      setCurProject,
      projectLoading,
      filePath,
      setFilePath,
      createProjectFromPrompt,
      forkProject,
      setProjectPublicStatus,
      pollChatProject,
      isLoading,
      getWebUrl,
      takeProjectScreenshot,
      refreshProjects,
      turnsDone,
      turnFinished,
      editorRef,
    }),
    [
      projects,
      curProject,
      projectLoading,
      filePath,
      createProjectFromPrompt,
      forkProject,
      setProjectPublicStatus,
      pollChatProject,
      isLoading,
      getWebUrl,
      takeProjectScreenshot,
      refreshProjects,
      turnsDone,
      turnFinished,
      editorRef,
    ]
  );

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}
