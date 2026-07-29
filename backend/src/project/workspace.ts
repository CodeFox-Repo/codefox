import type { LogLine } from './preview.service';

/**
 * Everything the product needs to do with a project's files, independent of
 * where those files actually live.
 *
 * The rest of the backend used to reach straight for `.codefox/projects` with
 * `node:fs` — the file tree, the editor, the preview, the cover screenshot and
 * the download all assumed a local disk. That is why the agent could not be
 * moved into a real sandbox: isolating it would have left every one of those
 * features reading an empty directory.
 *
 * Two implementations sit behind this: the host disk, and a Vercel microVM.
 * Nothing above this interface knows which one it is talking to.
 */
/** One file the project has diverged from its template on. */
export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

/** One point the project can be taken back to. */
export interface Version {
  /** Commit sha; what `restore` takes. */
  id: string;
  /** The message the snapshot was taken under — the user's own prompt. */
  label: string;
  /** ISO timestamp. */
  at: string;
  /** True for the version the working tree currently sits on. */
  current: boolean;
}

export interface ProjectWorkspace {
  /**
   * Every file in the project, as paths relative to its root, with shared
   * dependencies and build output left out.
   */
  listFiles(): Promise<string[]>;

  /**
   * What the agent has actually touched — the project relative to its git
   * baseline (every workspace starts as a clone of the template). Null when
   * there is no git history to diff against.
   */
  changedFiles(): Promise<ChangedFile[] | null>;

  /**
   * Commit whatever the turn changed, so it becomes a point the project can
   * be brought back to. No-op when nothing changed or there is no git.
   * Returns the new version's id, or null when nothing was committed.
   */
  snapshot(label: string): Promise<string | null>;

  /**
   * Every snapshot, newest first. Null when the project has no git history.
   */
  versions(): Promise<Version[] | null>;

  /**
   * Put the working tree back to a version. Whatever the tree currently holds
   * is snapshotted first, so a restore is itself undoable.
   */
  restore(versionId: string): Promise<void>;

  /** File contents as text, or null when there is no such file. */
  readFile(relativePath: string): Promise<string | null>;

  /** Writes the file, creating parent directories as needed. */
  writeFile(relativePath: string, content: string): Promise<void>;

  /**
   * Bring up the project's dev server and return where a browser should point.
   *
   * The address is public in both modes, but for different reasons: a remote
   * sandbox publishes its own URL, while on the host the dev server binds to
   * loopback and is reached through this origin's preview proxy.
   */
  startPreview(): Promise<{ url: string }>;

  /** Dev-server output for the Console tab. Empty when nothing is running. */
  previewLogs(): Promise<LogLine[]>;

  /** Stops the dev server if one is running. Safe to call when none is. */
  stopPreview(): Promise<void>;

  /**
   * An address the backend itself can fetch — what the cover screenshot aims
   * at. Null when no preview is running.
   */
  internalPreviewUrl(): Promise<string | null>;

  /** A zip of the project on the backend's own disk, ready to stream out. */
  archive(projectName: string): Promise<{ zipPath: string; fileName: string }>;

  /** Throw the project's storage away. Best effort; never throws. */
  remove(): Promise<void>;
}

/** Never part of the user's project: shared deps, vcs data, build output. */
export const IGNORED_ENTRIES = [
  'node_modules',
  '.codefox-uploads',
  // The harness's own bridge state, which lives inside the project in a
  // sandbox. Not the user's code, and it leaked into every download.
  '.agent-runs',
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  '.cache',
  'dist',
  'build',
  'out',
  'coverage',
  '.DS_Store',
];

/**
 * The log format both workspaces ask git for, and the parser for it. Kept
 * together so the two can never drift: a field added to one without the other
 * would silently shift every column.
 */
export const VERSION_LOG_FORMAT = '%H\x1f%cI\x1f%s';

/**
 * `git log` lines into Version records, newest first. `head` is the sha the
 * working tree sits on, which marks the current entry.
 */
export function parseVersionLog(output: string, head: string): Version[] {
  const versions: Version[] = [];
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const [id, at, ...rest] = line.split('\x1f');
    if (!id || !at) continue;
    versions.push({
      id,
      at,
      label: rest.join('\x1f').trim() || 'Snapshot',
      current: id === head.trim(),
    });
  }
  return versions;
}

/**
 * `git status --porcelain` lines into ChangedFile records. Renames report the
 * new path; the ignore list keeps agent scratch out of the view.
 */
export function parsePorcelain(output: string): ChangedFile[] {
  const changes: ChangedFile[] = [];
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const flags = line.slice(0, 2);
    let file = line.slice(3).trim();
    const arrow = file.indexOf(' -> ');
    if (arrow !== -1) file = file.slice(arrow + 4);
    file = file.replace(/^"|"$/g, '');
    if (
      IGNORED_ENTRIES.some(
        (name) => file === name || file.startsWith(`${name}/`),
      )
    )
      continue;
    const status: ChangedFile['status'] = flags.includes('D')
      ? 'deleted'
      : flags === '??' || flags.includes('A')
        ? 'added'
        : 'modified';
    changes.push({ path: file, status });
  }
  return changes;
}
