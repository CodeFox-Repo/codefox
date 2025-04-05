import { logger } from '@/app/log/logger';
import { StyleProcessor } from './styleProcessor';
import { TailwindConverter } from './tailwindConverter';
import { CodeManipulator } from './codeManipulator';

export interface ComponentData {
  id: string;
  name: string;
  path: string;
  line: string;
  file: string;
  [key: string]: any;
}

export interface StyleChanges {
  [key: string]: string;
}

/**
 * Service to persist style changes to source code files
 */
export class StyleUpdateService {
  // Static property to store project path
  static projectPath: string = '';

  /**
   * Set the current project path
   */
  static setProjectPath(path: string) {
    this.projectPath = path;
    logger.info(`StyleUpdateService: Project path set to ${path}`);
  }

  /**
   * Get the full file path with project prefix
   */
  private static getFullFilePath(filePath: string): string {
    // If path already begins with the project path, don't add it again
    if (filePath.startsWith(this.projectPath)) {
      return filePath;
    }
    return `${this.projectPath}/frontend/${filePath}`;
  }

  /**
   * Persist style changes to the source code file
   * This now has option to use Tailwind classes instead of inline styles
   */
  static async persistStyleChanges(
    component: ComponentData,
    styles: StyleChanges
  ): Promise<boolean> {
    try {
      logger.info(`Persisting style changes for component: ${component.name}`, {
        styles,
      });

      const fullFilePath = this.getFullFilePath(component.path);

      // First, fetch the original file content
      const fileResponse = await fetch(
        `/api/file?path=${encodeURIComponent(fullFilePath)}`
      );
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fullFilePath}`);
      }

      const fileData = await fileResponse.json();
      const originalContent = fileData.content;

      // Log original content for debugging (first 100 chars)
      console.log(
        'Original content sample:',
        originalContent.substring(0, 100)
      );

      // Use Tailwind classes approach
      const updatedContent = CodeManipulator.applyTailwindClassesToCode(
        originalContent,
        parseInt(component.line),
        styles
      );

      // Log what we're about to do for debugging
      console.log('Preparing to save file changes:', {
        filePath: fullFilePath,
        originalSize: originalContent.length,
        updatedSize: updatedContent.length,
        componentLine: component.line,
      });

      // Save the updated content back to the file
      const updateResponse = await fetch('/api/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: fullFilePath,
          newContent: updatedContent,
        }),
      });

      const responseData = await updateResponse.json();

      if (!updateResponse.ok) {
        console.error('API error response:', responseData);
        throw new Error(
          `Failed to update file: ${responseData.error || 'Unknown error'}`
        );
      }

      logger.info(`Successfully persisted style changes to ${fullFilePath}`);
      console.log('File update response:', responseData);

      return true;
    } catch (error) {
      logger.error('Error persisting style changes:', error);
      console.error('StyleUpdateService error:', error);
      return false;
    }
  }

  /**
   * Persist content changes to the source code file
   */
  static async persistContentChanges(
    component: ComponentData,
    content: string
  ): Promise<boolean> {
    try {
      logger.info(
        `Persisting content changes for component: ${component.name}`
      );

      const fullFilePath = this.getFullFilePath(component.path);

      // First, fetch the original file content
      const fileResponse = await fetch(
        `/api/file?path=${encodeURIComponent(fullFilePath)}`
      );
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fullFilePath}`);
      }

      const fileData = await fileResponse.json();
      const originalContent = fileData.content;

      // Update the file with new content
      let updatedContent = CodeManipulator.applyContentToCode(
        originalContent,
        parseInt(component.line),
        content
      );

      // Validate the JSX syntax to catch potential errors
      updatedContent = CodeManipulator.validateJsxSyntax(updatedContent);

      // Log what we're about to do for debugging
      console.log('Preparing to save content changes:', {
        filePath: fullFilePath,
        originalSize: originalContent.length,
        updatedSize: updatedContent.length,
        componentLine: component.line,
      });

      // Save the updated content back to the file
      const updateResponse = await fetch('/api/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: fullFilePath,
          newContent: updatedContent,
        }),
      });

      const responseData = await updateResponse.json();

      if (!updateResponse.ok) {
        console.error('API error response:', responseData);
        throw new Error(
          `Failed to update file: ${responseData.error || 'Unknown error'}`
        );
      }

      logger.info(`Successfully persisted content changes to ${fullFilePath}`);
      console.log('File update response:', responseData);

      return true;
    } catch (error) {
      logger.error('Error persisting content changes:', error);
      console.error('StyleUpdateService error:', error);
      return false;
    }
  }
}

// Re-export submodules for convenience
export { StyleProcessor, TailwindConverter, CodeManipulator };
