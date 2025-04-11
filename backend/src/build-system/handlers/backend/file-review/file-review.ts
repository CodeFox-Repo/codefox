import { BuildHandler, BuildResult } from 'src/build-system/types';
import { BuilderContext } from 'src/build-system/context';
import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

import { prompts } from './prompt';
import { formatResponse } from 'src/build-system/utils/strings';
import { MessageInterface } from 'src/common/model-provider/types';
import { chatSyncWithClocker } from 'src/build-system/utils/handler-helper';
import {
  FileNotFoundError,
  FileModificationError,
  ResponseParsingError,
  ModelUnavailableError,
} from 'src/build-system/errors';
import { BuildNode, BuildNodeRequire } from 'src/build-system/hanlder-manager';
import { BackendRequirementHandler } from '../requirements-document';
import { BackendCodeHandler } from '../code-generate';

/**
 * Responsible for reviewing all related source root files and considering modifications
 * such as package.json, tsconfig.json, .env, etc., in JS/TS projects.
 *
 * Dependencies:
 * - BackendCodeHandler: Provides the generated backend code and indirectly provides
 *   access to backend requirements through its own dependency on BackendRequirementHandler
 */
@BuildNode()
@BuildNodeRequire([BackendCodeHandler, BackendRequirementHandler])
export class BackendFileReviewHandler implements BuildHandler<string> {
  readonly logger: Logger = new Logger('BackendFileModificationHandler');

  async run(context: BuilderContext): Promise<BuildResult<string>> {
    this.logger.log('Starting backend file modification process...');

    const backendPath = context.getGlobalContext('backendPath') || './backend';
    const projectName =
      context.getGlobalContext('projectName') || 'Default Project Name';
    const description =
      context.getGlobalContext('description') || 'Default Project Description';
    const projectOverview = `
        project name: ${projectName}
        project description: ${description},
      `;

    const backendRequirement = context.getNodeData(BackendRequirementHandler);
    const backendCode = [context.getNodeData(BackendCodeHandler)];

    if (!backendRequirement) {
      throw new FileNotFoundError('Backend requirements are missing.');
    }

    let files: string[];
    try {
      this.logger.log(`Scanning backend directory: ${backendPath}`);
      files = await fs.readdir(backendPath);
      this.logger.debug(`Found files: ${files.join(', ')}`);
    } catch (error) {
      throw new FileNotFoundError(
        'No files found in the backend directory:' + error,
      );
    }

    const filePrompt = prompts.identifyBackendFilesToModify(
      files,
      backendRequirement,
      projectOverview,
      backendCode,
    );

    let modelResponse: string;

    try {
      const messages: MessageInterface[] = [
        { content: filePrompt, role: 'system' },
      ];
      modelResponse = await chatSyncWithClocker(
        context,
        {
          model: 'gpt-4o-mini',
          messages,
        },
        'generateBackendCode',
        BackendFileReviewHandler.name,
      );
    } catch (error) {
      throw new ModelUnavailableError('Model Unavailable:' + error);
    }

    const filesToModify = this.parseFileIdentificationResponse(modelResponse);
    if (!filesToModify.length) {
      throw new FileModificationError('No files identified for modification.');
    }
    this.logger.log(`Files to modify: ${filesToModify.join(', ')}`);

    for (const fileName of filesToModify) {
      const filePath = path.join(backendPath, fileName);
      let currentContent: string;
      try {
        currentContent = await fs.readFile(filePath, 'utf-8');
      } catch (error) {
        throw new FileNotFoundError(
          `Failed to read file: ${fileName}:` + error,
        );
      }
      const modificationPrompt = prompts.generateFileModificationPrompt(
        fileName,
        currentContent,
        backendRequirement,
        projectOverview,
        backendCode,
      );

      let response;
      try {
        response = await chatSyncWithClocker(
          context,
          {
            model: 'gpt-4o-mini',
            messages: [{ content: modificationPrompt, role: 'system' }],
          },
          'generateBackendFile',
          BackendFileReviewHandler.name,
        );
      } catch (error) {
        throw new ModelUnavailableError('Model Unavailable:' + error);
      }
      const newContent = formatResponse(response);

      await fs.writeFile(filePath, newContent, 'utf-8');

      this.logger.log(`Successfully modified ${fileName}`);
    }

    return {
      success: true,
      data: `Modified files: ${filesToModify.join(', ')}`,
    };
  }

  /**
   * Parses the file identification response from the model.
   */
  parseFileIdentificationResponse(response: string): string[] {
    try {
      const parsedResponse = JSON.parse(formatResponse(response));
      if (!Array.isArray(parsedResponse)) {
        throw new ResponseParsingError(
          'File identification response is not an array.',
        );
      }
      this.logger.log('Parsed file identification response:', parsedResponse);
      return parsedResponse;
    } catch (error) {
      this.logger.error('Error parsing file identification response:', error);
      throw new ResponseParsingError(
        'Failed to parse file identification response.',
      );
    }
  }
}
