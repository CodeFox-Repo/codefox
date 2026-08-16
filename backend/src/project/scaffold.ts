import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import fsExtra from 'fs-extra';
import simpleGit from 'simple-git';
import { getProjectsDir, getRootDir } from '../common/utils/common-path';
import { DesignSystem, designSystem } from './design-systems';
import { Scenario, scenario, scenarioMeta } from './scenarios';

const { copy, existsSync, readdirSync, remove, symlink } = fsExtra;
const exec = promisify(execFile);
const logger = new Logger('Scaffold');

const TEMPLATE_REPO =
  process.env.TEMPLATE_REPO ??
  'https://github.com/Sma1lboy/nextjs-shadcn-template.git';

// Never copied into a generated project: vcs metadata, installed deps, build
// output, and images staged for the agent to read.
const SKIP = new Set(['.git', 'node_modules', '.next', '.codefox-uploads']);

/**
 * Local checkout of the starter template, cloned once and reused. A checked-in
 * `backend/template` directory wins when present, so the repo can vendor its
 * own template without touching the network.
 */
export async function ensureTemplate(): Promise<string> {
  const vendored = path.join(process.cwd(), 'template');
  const cached = path.join(getRootDir(), 'templates', 'default');
  const template = existsSync(vendored) ? vendored : cached;

  if (!existsSync(path.join(template, 'package.json'))) {
    logger.log(`Cloning starter template from ${TEMPLATE_REPO}`);
    await remove(cached);
    await simpleGit().clone(TEMPLATE_REPO, cached, ['--depth', '1']);
  }

  // Install once, here. Every generated project shares this tree by symlink,
  // so a project is usable the moment it is copied instead of after a
  // multi-minute install of its own.
  //
  // Existence is not enough: an interrupted install leaves an empty
  // `node_modules`, every project symlinks to it, and node resolution then
  // walks up to the monorepo's own dependencies — where a different Next
  // major lives, and the preview dies on `next.config.ts`.
  const modules = path.join(template, 'node_modules');
  const installed = existsSync(path.join(modules, 'next', 'package.json'));
  if (!installed) {
    logger.log('Installing template dependencies (first run only)…');
    await exec('npm', ['ci', '--no-audit', '--no-fund'], {
      cwd: template,
      maxBuffer: 32 * 1024 * 1024,
    });
    logger.log('Template dependencies installed');
  }

  // better-sqlite3 is not in the upstream template repo — it is ours, added
  // here so every generated app has a real database. Every project symlinks
  // THIS node_modules, so one install covers them all. Installing into the
  // template also writes it into the template's package.json and lockfile,
  // which is what every project then copies.
  if (!existsSync(path.join(modules, 'better-sqlite3', 'package.json'))) {
    logger.log('Adding better-sqlite3 to the shared template install…');
    await exec(
      'npm',
      [
        'install',
        'better-sqlite3',
        '--save',
        '--no-audit',
        '--no-fund',
      ],
      { cwd: template, maxBuffer: 32 * 1024 * 1024 }
    );
    await exec(
      'npm',
      ['install', '@types/better-sqlite3', '--save-dev', '--no-audit', '--no-fund'],
      { cwd: template, maxBuffer: 32 * 1024 * 1024 }
    );
    logger.log('better-sqlite3 available to all projects');
  }

  return template;
}

/**
 * The database helper every app project is born with.
 *
 * One SQLite file inside the project, via better-sqlite3 — no server, no
 * setup, no env var. It is there so an app built in one prompt can hold
 * state while it is being built and tested; it is a development store, not a
 * production one. Kept deliberately small: the agent is expected to write
 * its own schema and queries, this file only owns the connection.
 */
const DB_HELPER = `import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * The app's own database: a single SQLite file at data/app.db.
 *
 * The dev server reloads modules on every edit, so the connection lives on
 * globalThis — without that, each hot reload opens a new handle on the same
 * file until SQLite refuses them all.
 */
const globalForDb = globalThis as unknown as {
  __appDb?: Database.Database;
};

export function getDb(): Database.Database {
  if (!globalForDb.__appDb) {
    const dir = path.join(process.cwd(), 'data');
    mkdirSync(dir, { recursive: true });
    const db = new Database(path.join(dir, 'app.db'));
    // WAL + a busy timeout: the dev server and any background work can then
    // read while another request writes, instead of failing with BUSY.
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    globalForDb.__appDb = db;
  }
  return globalForDb.__appDb;
}
`;

/**
 * What makes a bare template clone a CodeFox app starter: the database
 * helper, the shadcn set at the canonical path, the dev badge off, and the
 * database file kept out of git.
 *
 * One list for both runtimes. Host mode writes these to the project
 * directory; sandbox mode writes them into the microVM through the
 * workspace — the sandbox clones the *upstream* template from git, so
 * without this its projects have none of it (this was the MONO Store
 * `Can't resolve '@/components/ui/button'` on the public wall).
 */
export interface StarterExtra {
  path: string;
  content: string;
  /** Append to whatever the template ships rather than replacing it. */
  append?: boolean;
}

/**
 * The database driver, as dependency declarations. Host projects get these
 * from the template's own package.json (ensureTemplate installs into it);
 * sandbox projects clone the *upstream* template, which never heard of
 * them — so the sandbox branch merges these into the clone's package.json.
 */
export const STARTER_DB_DEPS = {
  dependencies: { 'better-sqlite3': '^13.0.3' },
  devDependencies: { '@types/better-sqlite3': '^9.6.0' },
};

export async function appStarterExtras(): Promise<StarterExtra[]> {
  const template = await ensureTemplate();

  const extras: StarterExtra[] = [
    { path: 'src/lib/db.ts', content: DB_HELPER },
    {
      path: '.gitignore',
      content: '\n# the app database is data, not source\ndata/\n',
      append: true,
    },
  ];

  // The template carries the full shadcn set under the registry path it was
  // generated with, which no model reaches for on its own. Give it the
  // canonical import path instead.
  const uiDir = path.join(template, 'src/registry/new-york-v4/ui');
  const walk = (dir: string, prefix: string): string[] =>
    fsExtra
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) =>
        e.isDirectory()
          ? walk(path.join(dir, e.name), `${prefix}${e.name}/`)
          : [`${prefix}${e.name}`]
      );
  for (const rel of walk(uiDir, '')) {
    extras.push({
      path: `src/components/ui/${rel}`,
      content: await fsExtra.readFile(path.join(uiDir, rel), 'utf8'),
    });
  }

  // The floating Next dev badge is noise on a generated app's preview.
  const config = await fsExtra.readFile(
    path.join(template, 'next.config.ts'),
    'utf8'
  );
  extras.push({
    path: 'next.config.ts',
    content: config.includes('devIndicators')
      ? config
      : config.replace(
          /const nextConfig: NextConfig = \{/,
          `$&\n    // the floating dev badge is noise on a generated app's preview\n    devIndicators: false,`
        ),
  });

  return extras;
}

/**
 * Materialise a new project directory from the template.
 *
 * Returns the directory name, which is what `Project.projectPath` stores and
 * what the frontend's file APIs resolve under `.codefox/projects`.
 */
export async function scaffoldProject(projectId: string): Promise<string> {
  const template = await ensureTemplate();
  const target = path.join(getProjectsDir(), projectId);

  await copy(template, target, {
    filter: (src) => !SKIP.has(path.basename(src)),
  });

  // Injected here rather than upstream so a plain template update can never
  // drop them. Same list sandbox mode writes into the microVM.
  for (const extra of await appStarterExtras()) {
    const file = path.join(target, extra.path);
    await fsExtra.ensureDir(path.dirname(file));
    if (extra.append) await fsExtra.appendFile(file, extra.content);
    else await fsExtra.writeFile(file, extra.content);
  }

  // ponytail: shared node_modules, one install for every project. Fine while
  // every project comes from the same template — give a project its own
  // install once the agent is allowed to add dependencies.
  await symlink(
    path.join(template, 'node_modules'),
    path.join(target, 'node_modules'),
    'dir',
  ).catch(() => undefined);

  // A git baseline is what makes "what changed" answerable — the sandbox
  // gets one for free from its clone; the host copy deliberately skips .git,
  // so seed a fresh repo with the template as the first commit.
  try {
    const git = simpleGit(target);
    await git.init();
    await git.add('-A');
    await git.commit('template baseline', undefined, {
      '--author': 'CodeFox <bot@codefox.local>',
      '--no-gpg-sign': null,
    });
  } catch (error) {
    logger.warn(`No git baseline for ${projectId}: ${error}`);
  }

  logger.log(`Scaffolded project ${projectId} from ${template}`);
  return projectId;
}

/**
 * Copy an existing project's files into a new directory.
 *
 * A fork used to reuse the source project's `projectPath`, which meant two
 * owners shared one directory on disk — editing the fork edited the original.
 */
export async function copyProject(
  fromProjectPath: string,
  toProjectId: string,
  /** The fork's kind, so an empty source falls back to the right starter. */
  template?: string | null,
): Promise<string> {
  const from = path.join(getProjectsDir(), fromProjectPath);
  const to = path.join(getProjectsDir(), toProjectId);

  // Existence is not enough: a directory holding only skipped entries copies
  // to an empty tree, and the fork opens with no files at all. Check for
  // something actually copyable.
  const copyable =
    existsSync(from) && readdirSync(from).some((entry) => !SKIP.has(entry));

  if (!copyable) {
    logger.warn(`Source ${fromProjectPath} has no files; scaffolding instead`);
    // The fork keeps the source's kind, so the fallback has to match it. A
    // Next starter under template:'html' renders as a blank srcdoc preview —
    // it looks for an index.html the Next scaffold does not have.
    return template === 'html'
      ? scaffoldHtmlProject(toProjectId)
      : scaffoldProject(toProjectId);
  }

  await copy(from, to, { filter: (src) => !SKIP.has(path.basename(src)) });
  await symlink(
    path.join(await ensureTemplate(), 'node_modules'),
    path.join(to, 'node_modules'),
    'dir',
  ).catch(() => undefined);

  logger.log(`Copied ${fromProjectPath} -> ${toProjectId}`);
  return toProjectId;
}

/**
 * The whole starter for an html project: one self-contained page, already
 * wearing the chosen design system. The tokens are the page's style
 * contract — the agent is told to build against the variables rather than
 * pick colors, which is what keeps a generated page looking deliberate
 * instead of like default Tailwind.
 */
const htmlStarter = (style: DesignSystem, kind?: Scenario): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- What this page is. Read back on every turn to remind the agent what
         shape it is building; the style lives in :root the same way. An
         unpicked scenario writes no tag: the user's words are the brief. -->
    ${kind ? scenarioMeta(kind.id) : ''}
    <title>New Project</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      /* Design system: ${style.name} — ${style.blurb}.
         Build against these variables; changing a value restyles the page. */
      :root {
${style.tokens}
      }
      body {
        background: var(--bg);
        color: var(--fg);
        font-family: var(--font-body);
        font-size: var(--text-base);
        line-height: var(--leading-body);
      }
      h1, h2, h3 {
        font-family: var(--font-display);
        line-height: var(--leading-tight);
        letter-spacing: var(--tracking-display);
      }
    </style>
  </head>
  <body class="grid min-h-screen place-items-center">
    <main class="text-center">
      <h1 style="font-size: var(--text-2xl)">Hello.</h1>
      <p style="color: var(--muted); margin-top: var(--space-2, 8px)">
        Tell the agent what this page should become.
      </p>
    </main>
  </body>
</html>
`;

/**
 * Scaffold the light kind: a directory with one index.html and a git
 * baseline. No dependencies, no dev server — the preview renders the file.
 */
export async function scaffoldHtmlProject(
  projectId: string,
  style?: string | null,
  scenarioId?: string | null,
): Promise<string> {
  const target = path.join(getProjectsDir(), projectId);
  await fsExtra.ensureDir(target);
  await fsExtra.writeFile(
    path.join(target, 'index.html'),
    htmlStarter(designSystem(style), scenario(scenarioId)),
  );

  try {
    const git = simpleGit(target);
    await git.init();
    await git.add('-A');
    await git.commit('starter baseline', undefined, {
      '--author': 'CodeFox <bot@codefox.local>',
      '--no-gpg-sign': null,
    });
  } catch (error) {
    logger.warn(`No git baseline for ${projectId}: ${error}`);
  }

  logger.log(`Scaffolded html project ${projectId}`);
  return projectId;
}
