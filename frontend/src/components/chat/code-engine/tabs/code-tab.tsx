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
import { toast } from 'sonner';
import type { LintFinding } from '@/api/ChatStreamAPI';
import { fixLintMessage } from '@/lib/lint-request';
import { ProjectContext } from '../project-context';

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

/** P0 is a must-fix, P1 should be fixed, P2 is advice. Same three tones the
 *  change list uses, so the panel reads as one thing. */
const SEVERITY_TONE: Record<LintFinding['severity'], string> = {
  P0: 'text-destructive',
  P1: 'text-amber-500',
  P2: 'text-muted-foreground',
};

/** One point the project can be taken back to — a snapshot per agent turn. */
interface Version {
  id: string;
  label: string;
  at: string;
  current: boolean;
}

const VIEWS = ['changes', 'all', 'history'] as const;
type View = (typeof VIEWS)[number];

const VIEW_LABEL: Record<View, string> = {
  changes: 'Changes',
  all: 'All files',
  history: 'History',
};

/** "just now" / "14m ago" / "3h ago" / "2d ago". */
function ago(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface CodeTabProps {
  editorRef: MutableRefObject<any>;
  projectPath?: string | null;
  fileStructureData: Record<string, TreeNode>;
  newCode: string;
  /** The displayed content belongs to the selected file. */
  fileReady?: boolean;
  isFileStructureLoading: boolean;
  updateSavingStatus: (value: string) => void;
  filePath: string | null;
  setFilePath: (path: string | null) => void;
  /** Design findings for the page the last turn produced; empty when clean. */
  lint?: LintFinding[];
  /** Send a turn asking the agent to fix the findings. */
  onFixLint?: (message: string) => void;
  /** A turn is already streaming — a second one would only queue behind it. */
  turnRunning?: boolean;
}

const CodeTab = ({
  editorRef,
  projectPath,
  fileStructureData,
  newCode,
  fileReady = true,
  isFileStructureLoading,
  updateSavingStatus,
  filePath,
  setFilePath,
  lint,
  onFixLint,
  turnRunning = false,
}: CodeTabProps) => {
  const theme = useTheme();
  const { turnsDone = 0, turnFinished } = useContext(ProjectContext) ?? {};
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [isLoading] = useState(false);
  const [type, setType] = useState('javascript');
  // What the agent changed is the interesting set; the full tree is one
  // toggle away. Falls back to the tree when there is no git baseline.
  const [view, setView] = useState<View>('changes');
  const [changes, setChanges] = useState<ChangedFile[] | null>(null);
  const [changesLoading, setChangesLoading] = useState(true);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState(false);
  const versionsRequest = useRef(0);
  const [restoring, setRestoring] = useState<string | null>(null);
  /** Which project the view has already been coerced for. A project with no
   *  git baseline keeps `changes: null` forever, so deriving "first load"
   *  from the data would re-coerce on every finished turn — and a boolean
   *  would need a reset effect, which runs after this one. */
  const coercedFor = useRef<string | null>(null);

  // Loaded when the tab is first opened rather than with the panel: most
  // sessions never look at history, and it is a git log per project.
  const loadVersions = async () => {
    if (!projectPath) return;
    const request = ++versionsRequest.current;
    try {
      setVersionsLoading(true);
      setVersionsError(false);
      const res = await authenticatedFetch(
        `/api/project/versions?path=${encodeURIComponent(projectPath)}`
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (request !== versionsRequest.current) return;
      if (data.versions !== null && !Array.isArray(data.versions)) {
        throw new Error('Invalid version history response');
      }
      setVersions(data.versions);
    } catch {
      if (request === versionsRequest.current) setVersionsError(true);
    } finally {
      if (request === versionsRequest.current) setVersionsLoading(false);
    }
  };

  useEffect(() => {
    setVersions(null);
    setVersionsError(false);
    return () => {
      // A response for the previous project must not populate this history.
      // Invalidate the latest request, not a captured generation.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      versionsRequest.current++;
    };
  }, [projectPath]);

  const restore = async (versionId: string) => {
    if (!projectPath || restoring) return;
    let rejected = false;
    try {
      setRestoring(versionId);
      const res = await authenticatedFetch('/api/project/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath, versionId }),
      });
      if (!res.ok) {
        rejected = [400, 401, 403, 404, 422].includes(res.status);
        throw new Error(String(res.status));
      }
      const data = await res.json();
      // The restore rewrote the files, so the open editor and the changes
      // list are both stale. Drop the selection rather than show contents
      // that no longer match the file.
      setChanges(data.changes ?? null);
      setFilePath(null);
      await loadVersions();
      // A restore rewrites the tree the same way a turn does — files can
      // disappear, not just change — so everything keyed off a finished turn
      // has to repaint: the file tree, and the cover the preview shoots.
      turnFinished?.();
      toast.success('Files restored to that version');
    } catch {
      // A network or response failure may follow a completed server write.
      // Invalidate stale files and history, then reread instead of promising
      // that nothing changed or encouraging an immediate duplicate request.
      toast.error(
        rejected
          ? 'The restore request was rejected. Check your access and version history before trying again.'
          : "We couldn't confirm the restore. Check your files and version history before trying again."
      );
      if (!rejected) {
        setFilePath(null);
        setChanges(null);
        turnFinished?.();
      }
      setVersions(null);
      await loadVersions();
    } finally {
      setRestoring(null);
    }
  };

  useEffect(() => {
    if (!projectPath) return;
    let cancelled = false;
    const first = coercedFor.current !== projectPath;
    coercedFor.current = projectPath;
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
        // First load only. This effect reruns per finished turn now, so
        // coercing the view every time yanked the user off History mid-read
        // — and a transient fetch failure (a token refresh, say) did it to
        // whichever tab they were on.
        if (data.changes === null && first) setView('all');
      } catch {
        if (!cancelled) {
          setChanges(null);
          if (first) setView('all');
        }
      } finally {
        if (!cancelled) setChangesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectPath, turnsDone]);

  // Still lazy — nothing is fetched until History is actually open — but this
  // owns both the first open and every turn after, so the tab click no longer
  // carries its own load and the two cannot double-fire.
  useEffect(() => {
    if (view !== 'history' || !projectPath) return;
    void loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, projectPath, turnsDone]);

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
          {VIEWS.map((v) => (
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
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        {view === 'changes' ? (
          <div className="p-2">
            {changesLoading && !changes ? (
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
            {/* Nothing at all when the page is clean — an empty "no issues"
                panel is a claim the lint is not making. Held back while the
                file list refetches: findings arrive on the turn's stream and
                the list over a fetch, so showing them apart tears. */}
            {!changesLoading && lint && lint.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-border pt-3">
                {/* The panel used to end at the advice: the user read what was
                    wrong and then retyped it into the composer themselves.
                    This sends that turn. Hidden mid-turn — a second turn only
                    queues, and the findings describe a page being rewritten
                    right now. */}
                {onFixLint && (
                  <li className="flex items-center justify-between gap-2 px-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {lint.length} design{' '}
                      {lint.length === 1 ? 'note' : 'notes'}
                    </span>
                    <button
                      type="button"
                      disabled={turnRunning}
                      onClick={() => onFixLint(fixLintMessage(lint))}
                      className={cn(
                        'rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]',
                        'text-muted-foreground transition-colors',
                        'hover:bg-secondary hover:text-foreground',
                        'focus-visible:bg-secondary focus-visible:text-foreground',
                        turnRunning && 'cursor-not-allowed opacity-50'
                      )}
                      title="Ask the agent to fix these"
                    >
                      Fix these
                    </button>
                  </li>
                )}
                {lint.map((finding) => (
                  <li key={finding.id} className="px-2">
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          'shrink-0 font-mono text-[10px] uppercase tracking-[0.08em]',
                          SEVERITY_TONE[finding.severity]
                        )}
                      >
                        {finding.severity}
                      </span>
                      <span className="text-xs text-foreground">
                        {finding.message}
                      </span>
                    </div>
                    <p className="mt-0.5 pl-7 text-[11px] text-muted-foreground">
                      {finding.fix}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : view === 'history' ? (
          <div className="p-2">
            {versionsLoading && !versions ? (
              <p className="px-2 py-3 font-mono text-xs text-muted-foreground">
                Reading history…
              </p>
            ) : versionsError ? (
              <div role="alert" className="space-y-2 px-2 py-3">
                <p className="font-mono text-xs text-muted-foreground">
                  {"Couldn't load version history. Try again."}
                </p>
                <button
                  type="button"
                  onClick={() => void loadVersions()}
                  disabled={versionsLoading}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary"
                >
                  Try again
                </button>
              </div>
            ) : !versions || versions.length === 0 ? (
              <p className="px-2 py-3 font-mono text-xs text-muted-foreground">
                No history yet — each turn the agent takes becomes a version you
                can come back to.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {versions.map((version) => (
                  <li
                    key={version.id}
                    className={cn(
                      'group rounded px-2 py-1.5',
                      version.current ? 'bg-secondary' : 'hover:bg-accent'
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          'truncate text-xs',
                          version.current
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        )}
                        title={version.label}
                      >
                        {version.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {version.current ? 'Current' : ago(version.at)}
                      </span>
                      {!version.current && (
                        <button
                          type="button"
                          disabled={restoring !== null || versionsLoading}
                          onClick={() => void restore(version.id)}
                          className={cn(
                            'rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]',
                            'text-muted-foreground opacity-0 transition-opacity',
                            'hover:bg-secondary hover:text-foreground',
                            'group-hover:opacity-100 focus-visible:opacity-100',
                            restoring !== null && 'cursor-not-allowed'
                          )}
                        >
                          {restoring === version.id ? 'Restoring…' : 'Restore'}
                        </button>
                      )}
                    </div>
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
        {!fileReady && filePath && (
          <p
            role="status"
            className="absolute right-3 top-2 z-10 text-xs text-muted-foreground"
          >
            File contents are not loaded yet.
          </p>
        )}
        <Editor
          height="100%"
          width="100%"
          defaultLanguage="typescript"
          value={fileReady ? newCode : ''}
          language={type}
          loading={isLoading}
          onChange={updateSavingStatus}
          onMount={handleEditorMount}
          options={{
            readOnly: !fileReady,
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
