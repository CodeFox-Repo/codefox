'use client';
import {
  useState,
  useEffect,
  useContext,
  useRef,
  MutableRefObject,
} from 'react';
import { motion } from 'framer-motion';
import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import type { TreeNode } from '../file-structure';
import FileExplorerButton from '../file-explorer-button';
import FileStructure from '../file-structure';
import { authenticatedFetch } from '@/lib/authenticatedFetch';
import { cn } from '@/lib/utils';

/** One file the agent has touched, relative to the template baseline. */
interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

const STATUS_TONE: Record<ChangedFile['status'], string> = {
  added: 'text-green-500',
  modified: 'text-amber-500',
  deleted: 'text-destructive line-through',
};

interface CodeTabProps {
  editorRef: MutableRefObject<any>;
  projectPath?: string | null;
  fileStructureData: Record<string, TreeNode>;
  newCode: string;
  isFileStructureLoading: boolean;
  updateSavingStatus: (value: string) => void;
  filePath: string | null;
  setFilePath: (path: string | null) => void;
}

const CodeTab = ({
  editorRef,
  projectPath,
  fileStructureData,
  newCode,
  isFileStructureLoading,
  updateSavingStatus,
  filePath,
  setFilePath,
}: CodeTabProps) => {
  const theme = useTheme();
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [isLoading] = useState(false);
  const [type, setType] = useState('javascript');
  // What the agent changed is the interesting set; the full tree is one
  // toggle away. Falls back to the tree when there is no git baseline.
  const [view, setView] = useState<'changes' | 'all'>('changes');
  const [changes, setChanges] = useState<ChangedFile[] | null>(null);
  const [changesLoading, setChangesLoading] = useState(true);

  useEffect(() => {
    if (!projectPath) return;
    let cancelled = false;
    (async () => {
      try {
        setChangesLoading(true);
        const res = await authenticatedFetch(
          `/api/project/changes?path=${encodeURIComponent(projectPath)}`
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        setChanges(data.changes ?? null);
        if (data.changes === null) setView('all');
      } catch {
        if (!cancelled) {
          setChanges(null);
          setView('all');
        }
      } finally {
        if (!cancelled) setChangesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  useEffect(() => {
    if (filePath) {
      const extension = filePath.split('.').pop()?.toLowerCase();
      switch (extension) {
        case 'js':
        case 'jsx':
          setType('javascript');
          break;
        case 'ts':
        case 'tsx':
          setType('typescript');
          break;
        case 'html':
          setType('html');
          break;
        case 'css':
          setType('css');
          break;
        case 'json':
          setType('json');
          break;
        case 'md':
          setType('markdown');
          break;
        default:
          setType('plaintext');
      }
    }
  }, [filePath]);

  // Handle editor mount
  const handleEditorMount = (editorInstance) => {
    editorRef.current = editorInstance;
    editorInstance.getDomNode().style.position = 'absolute';
  };

  return (
    <>
      {/* File Explorer Panel (collapsible) */}
      <motion.div
        animate={{
          width: isExplorerCollapsed ? '0px' : '300px',
          opacity: isExplorerCollapsed ? 0 : 1,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="overflow-y-auto border-r"
      >
        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
          {(['changes', 'all'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
                view === v
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {v === 'changes' ? 'Changes' : 'All files'}
            </button>
          ))}
        </div>
        {view === 'changes' ? (
          <div className="p-2">
            {changesLoading ? (
              <p className="px-2 py-3 font-mono text-xs text-muted-foreground">
                Reading changes…
              </p>
            ) : !changes || changes.length === 0 ? (
              <p className="px-2 py-3 font-mono text-xs text-muted-foreground">
                No changes yet — everything is still the starter template.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {changes.map((change) => (
                  <li key={change.path}>
                    <button
                      type="button"
                      disabled={change.status === 'deleted'}
                      onClick={() => setFilePath(change.path)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded px-2 py-1 text-left font-mono text-xs transition-colors',
                        filePath === change.path
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        change.status === 'deleted' &&
                          'cursor-default opacity-60'
                      )}
                    >
                      <span
                        className={cn(
                          'w-3 shrink-0 text-center',
                          STATUS_TONE[change.status]
                        )}
                      >
                        {change.status === 'added'
                          ? 'A'
                          : change.status === 'deleted'
                            ? 'D'
                            : 'M'}
                      </span>
                      <span
                        className={cn(
                          'truncate',
                          change.status === 'deleted' && 'line-through'
                        )}
                      >
                        {change.path}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <FileStructure
            data={fileStructureData}
            filePath={filePath || ''}
            isLoading={isFileStructureLoading}
            onFileSelect={setFilePath}
          />
        )}
      </motion.div>

      {/* Code Editor */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          width="100%"
          defaultLanguage="typescript"
          value={newCode}
          language={type}
          loading={isLoading}
          onChange={updateSavingStatus}
          onMount={handleEditorMount}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            wordWrap: 'on',
            wrappingStrategy: 'advanced',
            folding: true,
            foldingHighlight: true,
            foldingStrategy: 'indentation',
            scrollbar: {
              useShadows: false,
              vertical: 'hidden',
              horizontal: 'hidden',
              verticalScrollbarSize: 0,
              horizontalScrollbarSize: 0,
            },
          }}
          theme={theme.theme === 'dark' ? 'vs-dark' : 'vs'}
        />
      </div>

      {/* File Explorer Toggle Button */}
      <FileExplorerButton
        isExplorerCollapsed={isExplorerCollapsed}
        setIsExplorerCollapsed={setIsExplorerCollapsed}
      />
    </>
  );
};

export default CodeTab;
