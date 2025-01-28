import { BuildHandler, BuildResult } from 'src/build-system/types';
import { BuilderContext } from 'src/build-system/context';
import { Logger } from '@nestjs/common';
import { chatSyncWithClocker } from 'src/build-system/utils/handler-helper';
import { generateFilesDependencyWithLayers } from '../../utils/file_generator_util';
import { readFileWithRetries, createFileWithRetries } from '../../utils/files';
import { VirtualDirectory } from '../../virtual-dir';

import { UXSMSHandler } from '../ux/sitemap-structure';
import { UXDMDHandler } from '../ux/datamap';
import { BackendRequirementHandler } from '../backend/requirements-document';
import { FileFAHandler } from '../file-manager/file-arch';
import { BuildNode, BuildNodeRequire } from 'src/build-system/hanlder-manager';
import normalizePath from 'normalize-path';
import path from 'path';
import { generateCSSPrompt, generateFrontEndCodePrompt } from './prompt';
import { formatResponse } from 'src/build-system/utils/strings';
import { writeFileSync } from 'fs';
import { MessageInterface } from 'src/common/model-provider/types';

/**
 * FrontendCodeHandler is responsible for generating the frontend codebase
 * based on the provided sitemap, data mapping documents, backend requirement documents,
 * frontendDependencyFile, frontendDependenciesContext, .
 */
@BuildNode()
@BuildNodeRequire([
  UXSMSHandler,
  UXDMDHandler,
  BackendRequirementHandler,
  FileFAHandler,
])
export class FrontendCodeHandler implements BuildHandler<string> {
  readonly logger: Logger = new Logger('FrontendCodeHandler');
  private virtualDir: VirtualDirectory;

  /**
   * Executes the handler to generate frontend code.
   * @param context - The builder context containing configuration and utilities.
   * @param args - The variadic arguments required for generating the frontend code.
   * @returns A BuildResult containing the generated code and related data.
   */
  async run(context: BuilderContext): Promise<BuildResult<string>> {
    this.logger.log('Generating Frontend Code...');

    // 1. Retrieve the necessary input from context
    const sitemapStruct = context.getNodeData(UXSMSHandler);
    const uxDataMapDoc = context.getNodeData(UXDMDHandler);
    const backendRequirementDoc = context.getNodeData(
      BackendRequirementHandler,
    );
    const fileArchDoc = context.getNodeData(FileFAHandler);

    // 2. Grab any globally stored context as needed
    this.virtualDir = context.virtualDirectory;
    const frontendPath = context.getGlobalContext('frontendPath');

    if (
      !sitemapStruct ||
      !uxDataMapDoc ||
      !backendRequirementDoc ||
      !fileArchDoc
    ) {
      this.logger.error(sitemapStruct);
      this.logger.error(uxDataMapDoc);
      this.logger.error(backendRequirementDoc);
      this.logger.error(fileArchDoc);
      throw new Error('Missing required parameters.');
    }

    // Dependency
    const { concurrencyLayers, fileInfos } =
      await generateFilesDependencyWithLayers(fileArchDoc, this.virtualDir);

    // 4. Process each "layer" in sequence; files in a layer in parallel
    for (const [layerIndex, layer] of concurrencyLayers.entries()) {
      this.logger.log(
        `\n==== Concurrency Layer #${layerIndex + 1} ====\nFiles: [${layer.join(
          ', ',
        )}]\n`,
      );

      const maxRetries = 3; // Maximum retry attempts per file
      const delayMs = 200; // Delay between retries for a file
      let remainingFiles = [...layer]; // Start with all files in the layer

      for (
        let attempt = 1;
        attempt <= maxRetries && remainingFiles.length > 0;
        attempt++
      ) {
        const failedFiles: any[] = [];

        await Promise.all(
          remainingFiles.map(async (file) => {
            this.logger.log(
              `Layer #${layerIndex + 1}, generating code for file: ${file}`,
            );

            // Resolve the absolute path where this file should be generated
            const currentFullFilePath = normalizePath(
              path.resolve(frontendPath, file),
            ); // src

            // Gather direct dependencies
            const directDepsArray = fileInfos[file]?.dependsOn || [];

            // Read each dependency and append to dependenciesContext
            let dependenciesText = '';
            for (const dep of directDepsArray) {
              this.logger.log(
                `Layer #${layerIndex + 1}, file "${file}" → reading dependency "${dep}"`,
              );
              try {
                // need to check if it really reflect the real path
                const resolvedDepPath = normalizePath(
                  path.resolve(frontendPath, dep),
                );

                // Read the content of the dependency file
                const depContent = await readFileWithRetries(
                  resolvedDepPath,
                  maxRetries,
                  delayMs,
                );

                dependenciesText += `\n\n<dependency>  File path: ${dep} \n\`\`\`typescript\n${depContent}\n\`\`\`\n </dependency>`;
              } catch (err) {
                this.logger.warn(
                  `Failed to read dependency "${dep}" for file "${file}": ${err}`,
                );
              }
            }

            // 5. Build prompt text depending on file extension
            const fileExtension = path.extname(file);
            let frontendCodePrompt = '';
            if (fileExtension === '.css') {
              frontendCodePrompt = generateCSSPrompt(
                file,
                directDepsArray.join('\n'),
              );
            } else {
              // default: treat as e.g. .ts, .js, .vue, .jsx, etc.
              frontendCodePrompt = generateFrontEndCodePrompt(
                file,
                directDepsArray.join('\n'),
              );
            }
            // this.logger.log(
            //   `Prompt for file "${file}":\n${frontendCodePrompt}\n`,
            // );

            const messages = [
              {
                role: 'system' as const,
                content: frontendCodePrompt,
              },
              {
                role: 'user' as const,
                content: `**Sitemap Structure**
              ${sitemapStruct}
              `,
              },
              // {
              //   role: 'user' as const,
              //   content: `This is the UX Datamap Documentation:
              // ${uxDataMapDoc}

              // Next will provide UX Datamap Documentation.`,
              // },
              // {
              //   role: 'user' as const,
              //   content: `This is the Backend Requirement Documentation:
              // ${backendRequirementDoc}

              // Next will provide Backend Requirement Documentation.`,
              // },
              {
                role: 'assistant',
                content:
                  "Good, now provider your dependencies, it's okay dependencies are empty, which means you don't have any dependencies",
              },
              {
                role: 'user' as const,
                content: `Dependencies:
                
                  ${dependenciesText}\n
                  Now you can provide the code.
                  `,
              },
            ] as MessageInterface[];

            // 6. Call your Chat Model
            let generatedCode = '';
            let modelResponse = '';
            try {
              modelResponse = await chatSyncWithClocker(
                context,
                {
                  model: 'gpt-4o',
                  messages,
                },
                'generate frontend code',
                FrontendCodeHandler.name,
              );

              generatedCode = formatResponse(modelResponse);

              // 7. Write the file to the filesystem
              await createFileWithRetries(
                currentFullFilePath,
                generatedCode,
                maxRetries,
                delayMs,
              );
            } catch (err) {
              this.logger.error(`Error generating code for ${file}:`, err);
              // FIXME: remove this later
              failedFiles.push(
                JSON.stringify({
                  file: file,
                  error: err,
                  modelResponse,
                  generatedCode,
                  messages,
                }),
              );
            }

            this.logger.log(
              `Layer #${layerIndex + 1}, completed generation for file: ${file}`,
            );
          }),
        );

        // Check if there are still files to retry
        if (failedFiles.length > 0) {
          writeFileSync(
            `./failedFiles-${attempt}.json`,
            JSON.stringify(failedFiles),
            'utf-8',
          );
          this.logger.warn(
            `Retrying failed files: ${failedFiles.join(', ')} (Attempt #${attempt})`,
          );
          remainingFiles = failedFiles; // Retry only the failed files
          await new Promise((resolve) => setTimeout(resolve, delayMs)); // Add delay between retries
        } else {
          remainingFiles = []; // All files in this layer succeeded
        }
      }

      this.logger.log(
        `\n==== Finished concurrency layer #${layerIndex + 1} ====\n`,
      );
    }

    return {
      success: true,
      data: frontendPath,
      error: new Error('Frontend code generated and parsed successfully.'),
    };
  }
}
