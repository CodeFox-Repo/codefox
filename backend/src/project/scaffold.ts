import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import fsExtra from 'fs-extra';
import simpleGit from 'simple-git';
import { getProjectsDir, getRootDir } from '../common/utils/common-path';
import { DesignSystem, designSystem } from './design-systems';
import { Scenario, scenario } from './scenarios';

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

  return template;
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
const htmlStarter = (style: DesignSystem, kind: Scenario): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- What this page is. Read back on every turn to remind the agent what
         shape it is building; the style lives in :root the same way. -->
    <meta name="codefox-scenario" content="${kind.id}" />
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
