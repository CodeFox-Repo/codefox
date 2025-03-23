import { Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { getProjectsDir, getProjectPath } from 'codefox-common';
import { FileWriteError } from '../errors';
const logger = new Logger('file-utils');
/**
 * Saves the given content to the specified file path using fs-extra.
 * Ensures that all directories in the path exist before writing the file.
 *
 * @param filePath - The complete file path including the file name.
 * @param content - The content to be written to the file.
 * @returns The file path where the content was written.
 * @throws Will throw an error if the file could not be written.
 */
export async function saveGeneratedCode(
  filePath: string,
  content: string,
): Promise<string> {
  try {
    // fs-extra's outputFile creates all directories if they don't exist
    await fs.outputFile(
      path.join(getProjectsDir(), filePath),
      content ? content : '',
      'utf8',
    );
    return filePath;
  } catch (error) {
    logger.error(`Error saving generated code to ${filePath}:`, error);
    throw error;
  }
}

/**
 * Copies a project template to a specific location under a given UUID folder.
 *
 * @param templatePath - The path to the project template containing files.
 * @param projectUUID - The UUID of the project folder.
 * @returns The path to the copied project directory.
 */
export async function copyProjectTemplate(
  templatePath: string,
  projectUUID: string,
  newFolderName?: string,
): Promise<string> {
  try {
    // Validate the template path
    const templateExists = await fs
      .access(templatePath)
      .then(() => true)
      .catch(() => false);
    if (!templateExists) {
      throw new Error(`Template path does not exist: ${templatePath}`);
    }
    // Get the template folder name, use newFolderName if provided
    const templateName = newFolderName || templatePath.split('/').pop();
    const destinationPath = path.join(
      getProjectPath(projectUUID),
      templateName,
    );
    // Copy the template to the destination
    logger.log(
      `Copying template from ${templatePath} to ${destinationPath}...`,
    );
    await fs.copy(templatePath, destinationPath);
    // Return the destination path
    logger.log(`Template copied successfully to ${destinationPath}`);
    return destinationPath;
  } catch (error) {
    logger.error('Error copying project template:', error);
    throw error;
  }
}

export function buildProjectPath(
  projectUUID: string,
  folderName?: string,
): string {
  return path.join(getProjectsDir(), projectUUID, folderName || '');
}

/**
 * Attempts to read a file's content, retrying up to `maxRetries` times
 * if a read error occurs (e.g., file not found or locked).
 *
 * @param filePath - The absolute path to the file you want to read
 * @param maxRetries - The number of retry attempts
 * @param delayMs - Delay (in ms) between retry attempts
 */
export async function readFileWithRetries(
  filePath: string,
  maxRetries = 3,
  delayMs = 200,
): Promise<string> {
  let attempt = 0;
  let lastError: any;

  while (attempt < maxRetries) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      lastError = error;
      attempt++;

      // Optionally log a warning or debug
      // logger.warn(`Failed to read file: ${filePath}, attempt #${attempt}`);

      // Wait a short delay before retrying
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // If we exhausted all retries, re-throw the last error
  return null;
}

/**
 * Attempts to create a file, retrying up to `maxRetries` times if it fails.
 *
 * @param filePath - The path to the file to be written.
 * @param content - The content to write to the file.
 * @param maxRetries - The number of retry attempts.
 * @param delayMs - Delay (in ms) between retry attempts.
 */
export async function createFileWithRetries(
  filePath: string,
  content: string,
  maxRetries = 3,
  delayMs = 200,
): Promise<void> {
  let attempt = 0;
  let lastError: any;

  while (attempt < maxRetries) {
    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write the file
      await fs.writeFile(filePath, content, 'utf-8');
      return; // Success, exit the retry loop
    } catch (error) {
      lastError = error;
      attempt++;

      // Optionally log a warning
      logger.warn(
        `Failed to write file: ${filePath}, attempt #${attempt}, content: ${content}`,
      );

      // Wait before retrying
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // If all retries fail, rethrow the last error
  throw new FileWriteError(lastError);
}
