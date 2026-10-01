'use client';
import { useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader } from 'lucide-react';
import type { TreeNode } from './file-structure';
import { ProjectContext } from './project-context';
import CodeTab from './tabs/code-tab';
import PreviewTab from './tabs/preview-tab';
import ConsoleTab from './tabs/console-tab';
import ResponsiveToolbar from './responsive-toolbar';
import SaveChangesBar from './save-changes-bar';
import { toast } from 'sonner';
import { logger } from '@/app/log/logger';
// These routes check ownership now, so they need the bearer token — a bare
// fetch got a 401 and the file tree retried it forever.
import { authenticatedFetch } from '@/lib/authenticatedFetch';
import type { LintFinding } from '@/api/ChatStreamAPI';

function CodeEngineForChat({
  chatId,
  isProjectReady = false,
  projectId,
  lint,
  onFixLint,
  turnRunning = false,
}: {
  chatId: string;
  isProjectReady?: boolean;
  projectId?: string;
  /** Design findings for the page the last turn produced; empty when clean. */
  lint?: LintFinding[];
  /** Send a turn asking the agent to fix the findings. Same path a typed
   *  message takes, so the fix is a version like any other turn. */
  onFixLint?: (message: string) => void;
  /** A turn is already streaming — a second one would only queue. */
  turnRunning?: boolean;
}) {
  const {
    curProject,
    projectLoading,
    pollChatProject,
    editorRef,
    turnsDone = 0,
  } = useContext(ProjectContext);
  const [localProject, setLocalProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [loadedFilePath, setLoadedFilePath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preCode, setPrecode] = useState('// Loading...');
  const [newCode, setCode] = useState('// Loading...');
  const editorState = useRef({ filePath, newCode });
  editorState.current = { filePath, newCode };
  const editedFile = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // Preview first: the product's promise is a running app beside the chat,
  // not a file tree. Code stays one tab away.
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'console'>(
    'preview'
  );
  const [isFileStructureLoading, setIsFileStructureLoading] = useState(false);
  const [fileStructureData, setFileStructureData] = useState<
    Record<string, TreeNode>
  >({});
  const projectPathRef = useRef(null);

  // A project is ready only when this chat has resolved its project data.
  // Elapsed time and a previous browser visit cannot confirm readiness.
  const [hasNoProject, setHasNoProject] = useState(false);

  useEffect(() => {
    if (!chatId || localProject || projectLoading) return;
    let superseded = false;
    const loadProjectFromChat = async () => {
      try {
        setIsLoading(true);
        const project = await pollChatProject(chatId);
        if (superseded) return;
        setHasNoProject(!project);
        if (project) setLocalProject(project);
      } catch (error) {
        logger.error('Failed to load project from chat:', error);
      } finally {
        if (!superseded) setIsLoading(false);
      }
    };
    void loadProjectFromChat();
    return () => {
      superseded = true;
    };
  }, [chatId, localProject, projectLoading, pollChatProject]);

  // Use either curProject from context or locally polled project
  // This chat's own project wins over the globally selected one.
  const activeProject = localProject || (chatId ? null : curProject);

  // Update projectPathRef when project changes
  useEffect(() => {
    if (activeProject?.projectPath) {
      projectPathRef.current = activeProject.projectPath;
    }
  }, [activeProject]);

  async function fetchFiles() {
    const projectPath = activeProject?.projectPath || projectPathRef.current;
    if (!projectPath) {
      return;
    }

    try {
      setIsFileStructureLoading(true);
      const response = await authenticatedFetch(
        `/api/project?path=${projectPath}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch file structure: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.res) {
        setFileStructureData(data.res);
      } else {
        logger.warn('Empty or invalid file structure data received');
      }
    } catch (error) {
      logger.error('Error fetching file structure:', error);
    } finally {
      setIsFileStructureLoading(false);
    }
  }

  // Effect for loading file structure when project is ready
  useEffect(() => {
    const shouldFetchFiles =
      isProjectReady &&
      (activeProject?.projectPath || projectPathRef.current) &&
      Object.keys(fileStructureData).length === 0 &&
      !isFileStructureLoading;

    if (shouldFetchFiles) {
      fetchFiles();
    }
  }, [
    isProjectReady,
    activeProject,
    isFileStructureLoading,
    fileStructureData,
  ]);

  // The effect above only fires while the tree is empty, so once loaded it
  // never refetched: a turn that added a file, and a restore that removed
  // one, both left "All files" showing the previous shape until the panel
  // was remounted. turnsDone is the signal both already raise.
  const treeAt = useRef(turnsDone);
  useEffect(() => {
    if (treeAt.current === turnsDone) return;
    treeAt.current = turnsDone;
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnsDone]);

  // Effect for selecting default file once structure is loaded
  useEffect(() => {
    if (
      !isFileStructureLoading &&
      Object.keys(fileStructureData).length > 0 &&
      !filePath
    ) {
      selectDefaultFile();
    }
  }, [isFileStructureLoading, fileStructureData, filePath]);

  // Retry mechanism for fetching files if needed
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

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
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

    if (firstFile) {
      setFilePath(firstFile[0].replace('root/', ''));
    }
  }

  const handleReset = () => {
    setCode(preCode);
    editorRef.current?.setValue(preCode);
    editedFile.current = null;
    setSaving(false);
  };

  const selectFilePath = (path: string | null) => {
    // Restore explicitly invalidates the open editor. A background reread
    // preserves drafts, but a requested version restore must read its files.
    if (path === null) {
      editedFile.current = null;
      setLoadedFilePath(null);
    }
    setFilePath(path);
  };

  const updateCode = async (value) => {
    const projectPath = activeProject?.projectPath || projectPathRef.current;
    // Returning quietly here used to read as success to handleSave.
    if (!projectPath || !filePath) {
      throw new Error('No file is open to save to');
    }

    try {
      const response = await authenticatedFetch('/api/file', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: `${projectPath}/${filePath}`,
          newContent: value,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update file: ${response.status}`);
      }

      await response.json();
    } catch (error) {
      logger.error('Error updating file:', error);
      // Rethrow: swallowing here is what let handleSave report a save that
      // never reached disk.
      throw error;
    }
  };

  const handleSave = async () => {
    if (!filePath || loadedFilePath !== filePath) {
      toast.error('Wait for this file to load before saving.');
      return;
    }
    const savedFile = filePath;
    const savedCode = newCode;
    try {
      await updateCode(savedCode);
    } catch {
      if (!mounted.current) return;
      // A delayed failure must not promise that the attempted draft is still
      // visible if the user has since opened another file or replaced it.
      const draftIsStillHere =
        editorState.current.filePath === savedFile &&
        editorState.current.newCode === savedCode;
      toast.error(
        draftIsStillHere
          ? "Couldn't save this file. Your edits are still here. Try again."
          : `Couldn't save ${savedFile}. The editor has changed since this save started.`
      );
      return;
    }
    if (!mounted.current || editorState.current.filePath !== savedFile) return;
    setPrecode(savedCode);
    const hasNewerEdits = editorState.current.newCode !== savedCode;
    setSaving(hasNewerEdits);
    if (!hasNewerEdits) editedFile.current = null;
  };

  const updateSavingStatus = (value) => {
    // The previous file may still be displayed while the next read is in
    // flight. Never treat its contents as an edit to the newly selected file.
    if (!filePath || loadedFilePath !== filePath) return;
    editedFile.current = filePath;
    setCode(value);
    setSaving(true);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'code':
        return (
          <CodeTab
            editorRef={editorRef}
            projectPath={activeProject?.projectPath || projectPathRef.current}
            fileStructureData={fileStructureData}
            newCode={newCode}
            fileReady={!!filePath && loadedFilePath === filePath}
            isFileStructureLoading={isFileStructureLoading}
            updateSavingStatus={updateSavingStatus}
            filePath={filePath}
            setFilePath={selectFilePath}
            lint={lint}
            onFixLint={onFixLint}
            turnRunning={turnRunning}
          />
        );
      case 'preview':
        return <PreviewTab project={activeProject} />;
      case 'console':
        return <ConsoleTab project={activeProject} />;
      default:
        return null;
    }
  };

  useEffect(() => {
    // Set when this effect is superseded — the file the user picked changed
    // while its read was in flight. Without it a slow read for a big file
    // landed after a fast read for a small one and put the WRONG contents in
    // the editor while `filePath`, the tree highlight and the tab all still
    // named the file the user actually picked. Typing one character then
    // saving wrote that other file's whole body over it, and nothing refetched
    // to reveal it — `preCode` was poisoned too, so Reset restored it as well.
    // Same guard code-tab.tsx already uses one file over.
    let superseded = false;

    async function getCode() {
      const projectPath = activeProject?.projectPath || projectPathRef.current;
      if (!projectPath || !filePath) return;

      const file_node = fileStructureData[`root/${filePath}`];
      if (!file_node) return;

      const isFolder = file_node.isFolder;
      if (isFolder) return;

      try {
        const res = await authenticatedFetch(
          `/api/file?path=${encodeURIComponent(`${projectPath}/${filePath}`)}`
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch file content: ${res.status}`);
        }

        const data = await res.json();
        if (superseded) return;
        // A background tree refresh is not permission to replace a draft.
        if (editedFile.current === filePath && loadedFilePath === filePath)
          return;
        editedFile.current = null;
        setLoadedFilePath(filePath);
        setCode(data.content);
        setPrecode(data.content);
        setSaving(false);
      } catch (error) {
        logger.error('Error loading file content:', error);
      }
    }

    getCode();
    return () => {
      superseded = true;
    };
  }, [filePath, activeProject, fileStructureData]);

  // Do not turn a stale global selection into a ready state while this
  // chat's own project is still being resolved.
  const showLoader =
    !hasNoProject &&
    (isLoading || !isProjectReady || !localProject?.projectPath);

  // Nothing to show a code panel for: this chat was started without a project,
  // so the tabs, the file tree and the preview all have no subject.
  if (hasNoProject) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="font-mono text-sm tracking-[0.12em] text-primary">
          NO PROJECT
        </p>
        <p className="max-w-[42ch] font-mono text-xs text-muted-foreground">
          This conversation was started on its own, so there are no files to
          show. Describe what you want built from the home page to get a project
          alongside the chat.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-scroll">
      <ResponsiveToolbar
        isLoading={showLoader}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        projectId={activeProject?.id || projectId}
      />

      <div className="relative h-[calc(100vh-48px-4rem)]">
        <AnimatePresence>
          {showLoader && (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-30"
            >
              <Loader
                aria-hidden="true"
                className="w-8 h-8 text-primary animate-spin"
              />
              <p role="status" className="text-sm text-muted-foreground">
                Preparing your project…
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex h-full">{renderTabContent()}</div>

        {saving && <SaveChangesBar onSave={handleSave} onReset={handleReset} />}
      </div>
    </div>
  );
}

export function CodeEngine(props: Parameters<typeof CodeEngineForChat>[0]) {
  return <CodeEngineForChat key={props.chatId} {...props} />;
}

export default CodeEngine;
