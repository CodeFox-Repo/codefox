import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import fsExtra from 'fs-extra';
import simpleGit from 'simple-git';
import { getProjectsDir, getRootDir } from '../common/utils/common-path';

const { copy, existsSync, remove, symlink } = fsExtra;
const exec = promisify(execFile);
const logger = new Logger('Scaffold');

const TEMPLATE_REPO =
  process.env.TEMPLATE_REPO ??
  'https://github.com/Sma1lboy/nextjs-shadcn-template.git';

// Never copied into a generated project: vcs metadata and installed deps.
const SKIP = new Set(['.git', 'node_modules', '.next']);

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
  if (!existsSync(path.join(template, 'node_modules'))) {
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
