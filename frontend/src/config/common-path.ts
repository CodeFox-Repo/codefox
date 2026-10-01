import * as path from 'path';
import { existsSync, mkdirSync, promises as fsPromises } from 'node:fs';
import { createHash } from 'crypto';

// Constants for the frontend root directory
const FRONTEND_ROOT_DIR = path.resolve(__dirname, '../.codefox-client');
const CLIENT_CACHE_DIR = path.join(FRONTEND_ROOT_DIR, '.cache');

// Utility function to ensure a directory exists
const ensureDir = (dirPath: string): string => {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

// ----------- We need path traverse Protection after we decide how we read and store the file !!!!!!!!!!!!! ------------
// -------------------------------------------------------------------------------------------------------------

// Step 1: Frontend Root Directory
export const getFrontendRootDir = (): string => ensureDir(FRONTEND_ROOT_DIR);

// Step 2: Cache Directory
export const getCacheDir = (): string => ensureDir(CLIENT_CACHE_DIR);

// Step 3: User Cache Directory
export const getUserCacheDir = (userId: string): string => {
  const hashedUserId = hashUserId(userId);
  return ensureDir(path.join(getCacheDir(), hashedUserId));
};

// Step 4: Project Cache Directory within a User's Directory
export const getProjectCacheDir = (
  userId: string,
  projectId: string
): string => {
  return ensureDir(path.join(getUserCacheDir(userId), projectId));
};

// Step 5: Content Directory within a Project's Cache Directory
export const getProjectContentDir = (
  userId: string,
  projectId: string
): string => {
  return ensureDir(path.join(getProjectCacheDir(userId, projectId), 'content'));
};

// Updated function to get the full path to a specific file within the 'content' directory
export const getProjectContentPath = (
  userId: string,
  projectId: string,
  fileName: string
): string => {
  return path.join(getProjectContentDir(userId, projectId), fileName);
};

// Helper function to hash user IDs for unique cache directories
const hashUserId = (userId: string): string => {
  return createHash('md5').update(userId).digest('hex');
};

// Utility Functions for File Operations
export const writeProjectContent = async (
  userId: string,
  projectId: string,
  fileName: string,
  content: string
): Promise<void> => {
  const contentPath = getProjectContentPath(userId, projectId, fileName);
  await fsPromises.writeFile(contentPath, content, 'utf8');
};

export const readProjectContent = async (
  userId: string,
  projectId: string,
  fileName: string
): Promise<string> => {
  const contentPath = getProjectContentPath(userId, projectId, fileName);
  return fsPromises.readFile(contentPath, 'utf8');
};

export const deleteProjectContent = async (
  userId: string,
  projectId: string,
  fileName: string
): Promise<void> => {
  const contentPath = getProjectContentPath(userId, projectId, fileName);
  if (existsSync(contentPath)) {
    await fsPromises.unlink(contentPath);
  }
};
