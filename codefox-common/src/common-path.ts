import * as path from 'path';

import fsExtra from 'fs-extra';
import { cwd } from 'process';
const { existsSync, mkdirSync, promises, writeFileSync } = fsExtra;

// Constants for base directories
const APP_NAME = 'codefox';
// TODO: hack way to get the root directory of the workspace

const WORKSPACE_ROOT = path.resolve(cwd(), '..');

const ROOT_DIR = path.join(WORKSPACE_ROOT, `.${APP_NAME}`);

export const TEMPLATE_PATH = path.join(WORKSPACE_ROOT, 'backend/template');
export const PROJECT_EVENT_PATH = path.join(ROOT_DIR, 'project-events');

export const getTemplatePath = (templateName: string): string =>
  path.join(TEMPLATE_PATH, templateName);
// Utility function to ensure a directory exists
const ensureDir = (dirPath: string): string => {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

// ----------- We need path traverse Protection after we decide how we read and store the file !!!!!!!!!!!!! ------------
// -------------------------------------------------------------------------------------------------------------

// Root Directory Accessor
export const getRootDir = (): string => ensureDir(ROOT_DIR);

// Configuration Paths
export const getConfigPath = (): string => {
  const rootPath = ensureDir(path.join(getRootDir()));
  return path.join(rootPath, 'config.json');
};

export const getModelStatusPath = (): string => {
  const rootPath = ensureDir(getRootDir());
  const modelStatusPath = path.join(rootPath, `model-status.json`);
  writeFileSync(modelStatusPath, '{}');
  return modelStatusPath;
};

//Media Directory
export const getMediaDir = (): string =>
  ensureDir(path.join(getRootDir(), 'media'));
export const getMediaPath = (modelName: string): string =>
  path.join(getModelsDir(), modelName);
export const getMediaAvatarsDir = (): string =>
  ensureDir(path.join(getMediaDir(), 'avatars'));

// Models Directory
export const getModelsDir = (): string =>
  ensureDir(path.join(getRootDir(), 'models'));
export const getModelPath = (modelName: string): string =>
  path.join(getModelsDir(), modelName);

// Embs Directory
export const getEmbDir = (): string =>
  ensureDir(path.join(getRootDir(), 'embeddings'));
export const getEmbPath = (modelName: string): string =>
  path.join(getModelsDir(), modelName);

// Project-Specific Paths
export const getProjectsDir = (): string =>
  ensureDir(path.join(getRootDir(), 'projects'));
export const getProjectPath = (projectId: string): string =>
  ensureDir(path.join(getProjectsDir(), projectId));
export const getProjectSourceDir = (projectId: string): string =>
  ensureDir(path.join(getProjectPath(projectId), 'src'));
export const getProjectGeneratedDir = (projectId: string): string =>
  ensureDir(path.join(getProjectPath(projectId), 'generated'));
export const getProjectTestsDir = (projectId: string): string =>
  ensureDir(path.join(getProjectPath(projectId), 'tests'));

// Database Paths
export const getDatabaseDir = (): string =>
  ensureDir(path.join(getRootDir(), 'data'));
export const getDatabasePath = (): string =>
  path.join(getDatabaseDir(), 'codefox.db');

// Vector Database (INDEX) Path
export const getIndexDir = (): string =>
  ensureDir(path.join(getRootDir(), 'INDEX'));
export const getIndexFilePath = (indexFileName: string): string =>
  path.join(getIndexDir(), indexFileName);

// Temporary files
export const getTempDir = (): string => {
  const tempDir = path.join(ROOT_DIR, 'temp');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
};

// Utility Functions
export const exists = (filePath: string): boolean => existsSync(filePath);

export const cleanTempDir = async (): Promise<void> => {
  const tempDir = getTempDir();
  const files = await promises.readdir(tempDir);
  await Promise.all(
    files.map((file) => promises.unlink(path.join(tempDir, file)))
  );
};

// Access Project Structure
export const getProjectStructure = (
  projectId: string
): {
  root: string;
  src: string;
  generated: string;
  tests: string;
} => ({
  root: getProjectPath(projectId),
  src: getProjectSourceDir(projectId),
  generated: getProjectGeneratedDir(projectId),
  tests: getProjectTestsDir(projectId),
});
