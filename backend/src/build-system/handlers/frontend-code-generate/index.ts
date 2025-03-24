import { BuildHandler, BuildResult } from 'src/build-system/types';
import { BuilderContext } from 'src/build-system/context';
import { Logger } from '@nestjs/common';
import { chatSyncWithClocker } from 'src/build-system/utils/handler-helper';
import { generateFilesDependencyWithLayers } from '../../utils/file_generator_util';
import { readFileWithRetries } from '../../utils/files';
import { VirtualDirectory } from '../../virtual-dir';

import { UXSMSHandler } from '../ux/sitemap-structure';
import { UXDMDHandler } from '../ux/datamap';
import { BackendRequirementHandler } from '../backend/requirements-document';
import { BuildNode, BuildNodeRequire } from 'src/build-system/hanlder-manager';
import normalizePath from 'normalize-path';
import path from 'path';
import { generateCSSPrompt, generateFrontEndCodePrompt } from './prompt';
import { removeCodeBlockFences } from 'src/build-system/utils/strings';
import { writeFileSync } from 'fs';
import { MessageInterface } from 'src/common/model-provider/types';

import { CodeValidator } from './CodeValidator';
import { CodeQueueProcessor, CodeTaskQueue } from './CodeReview';
// import { FileFAHandler } from '../file-manager/file-arch';
import { FileStructureAndArchitectureHandler } from '../file-manager/file-struct';
import { PRDHandler } from '../product-manager/product-requirements-document/prd';
import { UIUXLayoutHandler } from '../ux/uiux-layout';
interface FileInfos {
  [fileName: string]: {
    dependsOn: string[];
  };
}
/**
 * FrontendCodeHandler is responsible for generating the frontend codebase
 * based on the provided sitemap, data mapping documents, backend requirement documents,
 * frontendDependencyFile, frontendDependenciesContext, .
 */
@BuildNode()
@BuildNodeRequire([
  UXSMSHandler,
  UXDMDHandler,
  PRDHandler,
  UIUXLayoutHandler,
  BackendRequirementHandler,
  FileStructureAndArchitectureHandler,
])
// FileFAHandler,
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
    const prdHandler = context.getNodeData(PRDHandler);
    const uiUXLayoutHandler = context.getNodeData(UIUXLayoutHandler);
    // const prdHandler = context.getGlobalContext('projectOverview');
    const backendRequirementDoc = context.getNodeData(
      BackendRequirementHandler,
    );
    const fileArchDoc = context.getNodeData(
      FileStructureAndArchitectureHandler,
    );

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

    const renameMap = new Map<string, string>();

    // 3. Prepare for Dependency
    // have bug
    const { concurrencyLayers, fileInfos } =
      await generateFilesDependencyWithLayers(fileArchDoc, this.virtualDir);

    // concurrencyLayers.forEach((layer, index) => {
    //   console.log(`Layer #${index + 1} has ${layer.length} file(s):`, layer);
    // });

    // Object.entries(fileInfos).forEach(([filePath, info]) => {
    //   this.logger.debug(`File: ${filePath}`);
    //   this.logger.debug(`Depends On: ${info.dependsOn.join(', ')}`);
    // });

    const validator = new CodeValidator(frontendPath);
    // validator.installDependencies();

    // 4. Process each "layer" in sequence; files in a layer in parallel
    for (const [layerIndex, layer] of concurrencyLayers.entries()) {
      this.logger.log(
        `\n==== Concurrency Layer #${layerIndex + 1} ====\nFiles: [${layer.join(
          ', ',
        )}]\n`,
      );

      const queue = new CodeTaskQueue();

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

            const currentFullFilePath = normalizePath(
              path.resolve(frontendPath, file),
            );

            // Ensure fileInfos[file] exists before modifying
            if (!fileInfos[file]) {
              fileInfos[file] = {
                filePath: file, // Assuming `file` is the correct path
                dependsOn: [],
              };
            }

            // Gather direct dependencies
            let directDepsArray = fileInfos[file]?.dependsOn || [];

            // Replace old file names in dependencies with new ones
            directDepsArray = directDepsArray.map(
              (dep) => renameMap.get(dep) || dep,
            );

            // **Ensure the fileInfos structure is also updated**
            fileInfos[file].dependsOn = directDepsArray;

            const directDepsPathString = directDepsArray.join('\n');

            // Read each dependency and append to dependenciesContext
            const dependenciesText = await this.gatherDependenciesForFile(
              file,
              fileInfos,
              frontendPath,
            );

            this.logger.debug('dependency: ' + directDepsPathString);

            // generate code
            let generatedCode = '';
            // Adding into retry part.
            while (generatedCode === '') {
              this.logger.log(`Attempt to generate code for file: ${file}`);
              generatedCode = await this.generateFileCode(
                context,
                file,
                dependenciesText,
                directDepsPathString,
                uiUXLayoutHandler,
                backendRequirementDoc,
                prdHandler,
                failedFiles,
              );
            }

            // 7. Add the file to the queue for writing
            // Ensure the file path is relative by removing any leading slash
            this.logger.log('filepath: ' + file);
            const relativePath = file.startsWith('/')
              ? file.substring(1)
              : file;
            queue.enqueue({
              filePath: relativePath,
              fileContents: generatedCode,
              dependenciesPath: directDepsPathString,
            });
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
      // Now process the entire queue for this layer:
      // This writes each file, runs build, fixes if needed, etc.
      const queueProcessor = new CodeQueueProcessor(
        validator,
        queue,
        context,
        'frontend',
        frontendPath,
        renameMap,
      );
      await queueProcessor.processAllTasks();
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

  // get the dependencies content and path
  private async gatherDependenciesForFile(
    file: string,
    fileInfos: FileInfos,
    frontendPath: string,
  ): Promise<string> {
    const directDepsArray = fileInfos[file]?.dependsOn ?? [];
    let dependenciesText = '';

    for (const dep of directDepsArray) {
      try {
        let resolvedDepPath = dep;

        // Resolve alias-based paths (assuming `@/` maps to `frontendPath/src/`)
        if (dep.startsWith('@/')) {
          resolvedDepPath = path.join(
            frontendPath,
            'src',
            dep.replace(/^@\//, ''),
          );
        } else {
          resolvedDepPath = normalizePath(path.resolve(frontendPath, dep));
        }

        const depContent = await readFileWithRetries(resolvedDepPath, 3, 200);
        dependenciesText += `\n\n<dependency>  File path: ${dep}\n\`\`\`typescript\n${depContent}\n\`\`\`\n</dependency>`;
      } catch (err) {
        this.logger.warn(
          `Failed to read dependency "${dep}" for file "${file}"`,
          err,
        );
      }
    }

    return dependenciesText;
  }

  // Generate File Code
  private async generateFileCode(
    context: BuilderContext,
    file: string,
    dependenciesText: string,
    directDepsPathString: string,
    uiUXLayoutHandler: string,
    backendRequirementDoc: string,
    productRe: string,
    failedFiles: any[],
  ): Promise<string> {
    let generatedCode = '';
    let modelResponse = '';
    let messages = [];
    try {
      const fileExtension = path.extname(file);

      const isSPAFlag = context.getGlobalContext('isSPAFlag');

      let frontendCodePrompt = '';
      if (fileExtension === '.css') {
        frontendCodePrompt = generateCSSPrompt(file, directDepsPathString);
      } else {
        const theme = context.getGlobalContext('theme');
        // default: treat as e.g. .ts, .js, .vue, .jsx, etc.
        frontendCodePrompt = generateFrontEndCodePrompt(
          file,
          directDepsPathString,
          theme,
        );
      }
      // this.logger.log(
      //   `Prompt for file "${file}":\n${frontendCodePrompt}\n`,
      // );

      messages = [
        {
          role: 'system' as const,
          content: frontendCodePrompt,
        },
        {
          role: 'user' as const,
          content: `## product requirement
              ${productRe}

              ## project layout
              ${uiUXLayoutHandler}

              `,
        },
        {
          role: 'assistant',
          content:
            "Good, now provider your API Documentation, it's okay API Documentation are empty, which means I don't need use API",
        },
        {
          role: 'user' as const,
          content: `This is the API Documentation:
          ${backendRequirementDoc}`,
        },
        {
          role: 'assistant',
          content:
            "Good, now provider your dependencies, it's okay dependencies are empty, which means you don't have any dependencies",
        },
        {
          role: 'user' as const,
          content: `

          ## Overview of The Internal Dependencies filess you may need
            ${directDepsPathString}
          
          ## Detail about each Internal Dependencies:
            ${dependenciesText}\n
                  `,
        },
        {
          role: 'user',
          content: `Now you can provide the code. Do not be lazy.`,
        },
        // {
        //   role: 'assistant',
        //   content: codeReviewPrompt,
        // },
      ] as MessageInterface[];

      // 6. Call your Chat Model
      modelResponse = await chatSyncWithClocker(
        context,
        {
          model: isSPAFlag
            ? 'claude-3.7-sonnet' // Use Claude for SPAs
            : 'o3-mini-high', // Use default or fallback for non-SPAs
          messages,
        },
        'generate frontend code',
        FrontendCodeHandler.name,
      );

      this.logger.debug('generated code: ', modelResponse);
      generatedCode = removeCodeBlockFences(modelResponse);

      return generatedCode;
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
  }
}
