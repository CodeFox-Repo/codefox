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
export interface ProjectWorkspace {
  /**
   * Every file in the project, as paths relative to its root, with shared
   * dependencies and build output left out.
   */
  listFiles(): Promise<string[]>;

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
