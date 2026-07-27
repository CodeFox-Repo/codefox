import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import fsExtra from 'fs-extra';
import simpleGit from 'simple-git';
import { getProjectsDir, getRootDir } from '../common/utils/common-path';

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
    return scaffoldProject(toProjectId);
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
