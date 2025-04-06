'use client';
import { useContext, useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader } from 'lucide-react';
import { TreeItem, TreeItemIndex } from 'react-complex-tree';
import { ProjectContext } from './project-context';
import CodeTab from './tabs/code-tab';
import PreviewTab from './tabs/preview-tab';
import ConsoleTab from './tabs/console-tab';
import ResponsiveToolbar from './responsive-toolbar';
import SaveChangesBar from './save-changes-bar';
import { logger } from '@/app/log/logger';

export function CodeEngine({
  chatId,
  isProjectReady = false,
  projectId,
}: {
  chatId: string;
  isProjectReady?: boolean;
  projectId?: string;
}) {
  const {
    curProject,
    projectLoading,
    pollChatProject,
    editorRef,
    setRecentlyCompletedProjectId,
  } = useContext(ProjectContext);
  const [localProject, setLocalProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preCode, setPrecode] = useState('// Loading...');
  const [newCode, setCode] = useState('// Loading...');
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'console'>(
    'code'
  );
  const [isFileStructureLoading, setIsFileStructureLoading] = useState(false);
  const [fileStructureData, setFileStructureData] = useState<
    Record<TreeItemIndex, TreeItem<any>>
  >({});
  const projectPathRef = useRef(null);

  const [progress, setProgress] = useState(0);
  const [estimateTime, setEstimateTime] = useState(6 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const initialTime = 6 * 60;
  const [projectCompleted, setProjectCompleted] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const isProjectLoadedRef = useRef(false);

  useEffect(() => {
    if (projectCompleted) {
      setRecentlyCompletedProjectId(curProject?.id || localProject?.id);
    }
  }, [projectCompleted]);

  useEffect(() => {
    try {
      const savedCompletion = localStorage.getItem(
        `project-completed-${chatId}`
      );
      if (savedCompletion === 'true') {
        setProjectCompleted(true);
        isProjectLoadedRef.current = true;
        setProgress(100);
      }
    } catch (e) {
      logger.error('Failed to load project completion status:', e);
    }
  }, [chatId]);

  useEffect(() => {
    if (
      curProject?.id === chatId &&
      curProject?.projectPath &&
      !projectCompleted &&
      !isProjectLoadedRef.current
    ) {
      setProgress(100);
      setTimerActive(false);
      setIsCompleting(false);
      setProjectCompleted(true);
      isProjectLoadedRef.current = true;

      try {
        localStorage.setItem(`project-completed-${chatId}`, 'true');
      } catch (e) {
        logger.error('Failed to save project completion status:', e);
      }
    }
  }, [curProject?.projectPath, chatId, projectCompleted]);

  useEffect(() => {
    if (projectCompleted || isProjectLoadedRef.current) return;

    if (!curProject && chatId && !projectLoading) {
      const loadProjectFromChat = async () => {
        try {
          setIsLoading(true);
          const project = await pollChatProject(chatId);
          if (project) {
            if (project.projectPath) {
              setLocalProject(project);
              setProjectCompleted(true);
              isProjectLoadedRef.current = true;
              fetchFiles();
            } else {
              setLocalProject(project);
            }
          }
        } catch (error) {
          logger.error('Failed to load project from chat:', error);
        } finally {
          setIsLoading(false);
        }
      };

      loadProjectFromChat();
    } else {
      setIsLoading(projectLoading);
    }
  }, [chatId, curProject, projectLoading, pollChatProject, projectCompleted]);

  const activeProject = curProject || localProject;

  useEffect(() => {
    if (activeProject?.projectPath) {
      projectPathRef.current = activeProject.projectPath;
    }
  }, [activeProject]);

  async function fetchFiles() {
    const projectPath = activeProject?.projectPath || projectPathRef.current;
    if (!projectPath) return;

    try {
      setIsFileStructureLoading(true);
      const response = await fetch(`/api/project?path=${projectPath}`);
      if (!response.ok)
        throw new Error(`Failed to fetch file structure: ${response.status}`);
      const data = await response.json();
      if (data && data.res) setFileStructureData(data.res);
      else logger.warn('Empty or invalid file structure data received');
    } catch (error) {
      logger.error('Error fetching file structure:', error);
    } finally {
      setIsFileStructureLoading(false);
    }
  }

  useEffect(() => {
    const shouldFetchFiles =
      isProjectReady &&
      (activeProject?.projectPath || projectPathRef.current) &&
      Object.keys(fileStructureData).length === 0 &&
      !isFileStructureLoading;

    if (shouldFetchFiles) fetchFiles();
  }, [
    isProjectReady,
    activeProject,
    isFileStructureLoading,
    fileStructureData,
  ]);

  useEffect(() => {
    if (
      !isFileStructureLoading &&
      Object.keys(fileStructureData).length > 0 &&
      !filePath
    ) {
      selectDefaultFile();
    }
  }, [isFileStructureLoading, fileStructureData, filePath]);

  useEffect(() => {
    let retryTimeout;
    if (
      isProjectReady &&
      activeProject?.projectPath &&
      Object.keys(fileStructureData).length === 0 &&
      !isFileStructureLoading
    ) {
      retryTimeout = setTimeout(() => {
        logger.info('Retrying file structure fetch...');
        fetchFiles();
      }, 3000);
    }
    return () => retryTimeout && clearTimeout(retryTimeout);
  }, [
    isProjectReady,
    activeProject,
    fileStructureData,
    isFileStructureLoading,
  ]);

  function selectDefaultFile() {
    const defaultFiles = [
      'src/App.tsx',
      'src/App.js',
      'src/index.tsx',
      'src/index.js',
      'app/page.tsx',
      'pages/index.tsx',
      'index.html',
      'README.md',
    ];
    for (const defaultFile of defaultFiles) {
      if (fileStructureData[`root/${defaultFile}`]) {
        setFilePath(defaultFile);
        return;
      }
    }
    const firstFile = Object.entries(fileStructureData).find(
      ([key, item]) =>
        key.startsWith('root/') && !item.isFolder && key !== 'root/'
    );
    if (firstFile) setFilePath(firstFile[0].replace('root/', ''));
  }

  const handleReset = () => {
    setCode(preCode);
    editorRef.current?.setValue(preCode);
    setSaving(false);
  };

  const updateCode = async (value) => {
    const projectPath = activeProject?.projectPath || projectPathRef.current;
    if (!projectPath || !filePath) return;
    try {
      const response = await fetch('/api/file', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: `${projectPath}/${filePath}`,
          newContent: value,
        }),
      });
      if (!response.ok)
        throw new Error(`Failed to update file: ${response.status}`);
      await response.json();
    } catch (error) {
      logger.error('Error updating file:', error);
    }
  };

  const handleSave = () => {
    setSaving(false);
    setPrecode(newCode);
    updateCode(newCode);
  };

  const updateSavingStatus = (value) => {
    setCode(value);
    setSaving(true);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'code':
        return (
          <CodeTab
            editorRef={editorRef}
            fileStructureData={fileStructureData}
            newCode={newCode}
            isFileStructureLoading={isFileStructureLoading}
            updateSavingStatus={updateSavingStatus}
            filePath={filePath}
            setFilePath={setFilePath}
          />
        );
      case 'preview':
        return <PreviewTab />;
      case 'console':
        return <ConsoleTab />;
      default:
        return null;
    }
  };

  useEffect(() => {
    async function getCode() {
      const projectPath = activeProject?.projectPath || projectPathRef.current;
      if (!projectPath || !filePath) return;
      const file_node = fileStructureData[`root/${filePath}`];
      if (!file_node || file_node.isFolder) return;
      try {
        const res = await fetch(
          `/api/file?path=${encodeURIComponent(`${projectPath}/${filePath}`)}`
        );
        if (!res.ok)
          throw new Error(`Failed to fetch file content: ${res.status}`);
        const data = await res.json();
        setCode(data.content);
        setPrecode(data.content);
      } catch (error) {
        logger.error('Error loading file content:', error);
      }
    }
    getCode();
  }, [filePath, activeProject, fileStructureData]);

  const showLoader = useMemo(() => {
    if (projectCompleted || isProjectLoadedRef.current) return false;
    return (
      !isProjectReady ||
      isLoading ||
      (!activeProject?.projectPath && !projectPathRef.current && !localProject)
    );
  }, [
    isProjectReady,
    isLoading,
    activeProject,
    projectCompleted,
    localProject,
  ]);

  useEffect(() => {
    if (!showLoader && timerActive) {
      setIsCompleting(true);
      setProgress(99);
      const completionTimer = setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setTimerActive(false);
          setIsCompleting(false);
          setProjectCompleted(true);
          isProjectLoadedRef.current = true;
          try {
            localStorage.setItem(`project-completed-${chatId}`, 'true');
          } catch (e) {
            logger.error('Failed to save project completion status:', e);
          }
        }, 800);
      }, 500);
      return () => clearTimeout(completionTimer);
    }
    if (
      showLoader &&
      !timerActive &&
      !projectCompleted &&
      !isProjectLoadedRef.current &&
      estimateTime > 1
    ) {
      setTimerActive(true);
      setEstimateTime(initialTime);
      setProgress(0);
      setIsCompleting(false);
    }
  }, [showLoader, timerActive, projectCompleted, chatId]);

  useEffect(() => {
    let interval;
    if (timerActive) {
      interval = setInterval(() => {
        setEstimateTime((prevTime) => {
          if (prevTime <= 1) return 1;
          const elapsedTime = initialTime - prevTime + 1;
          setProgress(
            Math.min(Math.floor((elapsedTime / initialTime) * 100), 99)
          );
          return prevTime - 1;
        });
      }, 1000);
    }
    return () => interval && clearInterval(interval);
  }, [timerActive]);

  return (
    <div className="rounded-lg border shadow-sm overflow-scroll h-full">
      <ResponsiveToolbar
        isLoading={showLoader}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        projectId={curProject?.id || projectId}
      />
      <div className="relative h-[calc(100vh-48px-4rem)]">
        <AnimatePresence>
          {(showLoader || isCompleting) && (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-30"
            >
              {progress === 100 ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                  className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 text-green-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </motion.div>
              ) : (
                <Loader className="w-8 h-8 text-primary animate-spin" />
              )}
              <div className="w-64 flex flex-col items-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {progress === 100
                    ? 'Project ready!'
                    : projectLoading
                      ? 'Loading project...'
                      : `Preparing your project (about 5–6 minutes)…`}
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1">
                  <motion.div
                    className={`h-2.5 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-primary'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{
                      ease: progress === 100 ? 'easeOut' : 'easeInOut',
                      duration: progress === 100 ? 0.5 : 0.3,
                    }}
                  />
                </div>
                {estimateTime <= 1 && !projectCompleted && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Hang tight, almost there...
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex h-full">{renderTabContent()}</div>
        {saving && <SaveChangesBar onSave={handleSave} onReset={handleReset} />}
      </div>
    </div>
  );
}

export default CodeEngine;
