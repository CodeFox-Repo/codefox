import { BuildHandler, BuildResult } from 'src/build-system/types';
import { BuilderContext } from 'src/build-system/context';
import { generateBackendCodePrompt } from './prompt';
import * as path from 'path';
import { formatResponse } from 'src/build-system/utils/strings';
import { chatSyncWithClocker } from 'src/build-system/utils/handler-helper';
import {
  FileWriteError,
  InvalidParameterError,
  MissingConfigurationError,
  ResponseParsingError,
} from 'src/build-system/errors';
import { BuildNode, BuildNodeRequire } from 'src/build-system/hanlder-manager';
import { UXSMDHandler } from '../../ux/sitemap-document';
import { UXDMDHandler } from '../../ux/datamap';
import { DBSchemaHandler } from '../../database/schemas/schemas';
import { BackendRequirementHandler } from '../requirements-document';
import { MessageInterface } from 'src/common/model-provider/types';
import {
  CodeQueueProcessor,
  CodeTaskQueue,
} from '../../frontend-code-generate/CodeReview';
import { Logger } from '@nestjs/common';
import { CodeValidator } from '../../frontend-code-generate/CodeValidator';

/**
 * BackendCodeHandler is responsible for generating the backend codebase
 * based on the provided sitemap and data mapping documents.
 */

@BuildNode()
@BuildNodeRequire([UXDMDHandler, DBSchemaHandler, BackendRequirementHandler])
export class BackendCodeHandler implements BuildHandler<string> {
  readonly logger: Logger = new Logger('BackendCodeHandler');

  async run(context: BuilderContext): Promise<BuildResult<string>> {
    const projectName =
      context.getGlobalContext('projectName') || 'Default Project Name';
    const databaseType =
      context.getGlobalContext('databaseType') || 'Default database type';
    // Retrieve required documents
    const sitemapDoc = context.getNodeData(UXSMDHandler);
    const datamapDoc = context.getNodeData(UXDMDHandler);
    const databaseSchemas = context.getNodeData(DBSchemaHandler);
    const backendRequirementDoc =
      context.getNodeData(BackendRequirementHandler) || '';
    const backendPath = context.getGlobalContext('backendPath');
    this.logger.log('backendPath: ' + backendPath);

    // Validate required data
    if (!sitemapDoc || !datamapDoc || !databaseSchemas) {
      throw new MissingConfigurationError(
        `Missing required configuration: sitemapDoc, datamapDoc, or databaseSchemas: siteMapDoc: ${!!sitemapDoc}, datamapDoc: ${!!datamapDoc}, databaseSchemas: ${!!databaseSchemas}`,
      );
    }

    if (!databaseSchemas) {
      throw new InvalidParameterError(
        'databaseSchemas should be a valid object.',
      );
    }

    const validator = new CodeValidator(backendPath, 'backend'); //TODO: make here dynamic
    const queue = new CodeTaskQueue();
    const renameMap = new Map<string, string>();

    const currentFile = 'index.js';
    const dependencyFile = 'dependencies.json';

    // Generate the prompt using the provided documents and project name
    const backendCodePrompt = generateBackendCodePrompt(
      projectName,
      databaseType,
      currentFile,
      'Javascript', // TODO: make sure this lang come from the context
      dependencyFile,
    );

    const messages = [
      {
        role: 'system' as const,
        content: backendCodePrompt,
      },
      {
        role: 'user' as const,
        content: `## Database Schema:
        ${databaseSchemas}
                          `,
      },
      {
        role: 'user' as const,
        content: `## Backend Requirement:
        ${backendRequirementDoc}
                          `,
      },
      {
        role: 'user',
        content: `Now you can provide the code, don't forget the <GENERATE></GENERATE> tags. Do not be lazy.`,
      },
    ] as MessageInterface[];

    let generatedCode: string;
    try {
      const modelResponse = await chatSyncWithClocker(
        context,
        {
          // model: 'gpt-4o-mini',
          model: 'o3-mini-high',
          messages: messages,
        },
        'generateBackendCode',
        BackendCodeHandler.name,
      );
      generatedCode = formatResponse(modelResponse);
      if (!generatedCode) {
        throw new ResponseParsingError('Response tag extraction failed.');
      }
    } catch (error) {
      if (error instanceof ResponseParsingError) {
        throw error;
      }
      throw new ResponseParsingError(
        'Error occurred while parsing the model response.',
      );
    }

    // Save the generated code to the specified location
    const uuid = context.getGlobalContext('projectUUID');
    const savePath = path.join(uuid, 'backend', currentFile);

    try {
      // saveGeneratedCode(savePath, generatedCode);
      queue.enqueue({
        filePath: currentFile,
        fileContents: generatedCode,
        dependenciesPath: '',
      });
    } catch (error) {
      throw new FileWriteError(
        `Failed to save backend code to ${savePath}: ${error.message}`,
      );
    }

    const queueProcessor = new CodeQueueProcessor(
      validator,
      queue,
      context,
      'backend', //TODO: make here dynamic
      backendPath,
      renameMap,
    );
    await queueProcessor.processAllTasks();

    return {
      success: true,
      data: generatedCode,
    };
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// import { BuildHandler, BuildResult } from 'src/build-system/types';
// import { BuilderContext } from 'src/build-system/context';
// import { generateBackendCodePrompt } from './prompt';
// import { formatResponse } from 'src/build-system/utils/strings';
// import { chatSyncWithClocker } from 'src/build-system/utils/handler-helper';
// import {
//   FileWriteError,
//   InvalidParameterError,
//   MissingConfigurationError,
//   ResponseParsingError,
// } from 'src/build-system/errors';
// import { BuildNode, BuildNodeRequire } from 'src/build-system/hanlder-manager';
// import { UXSMDHandler } from '../../ux/sitemap-document';
// import { UXDMDHandler } from '../../ux/datamap';
// import { DBSchemaHandler } from '../../database/schemas/schemas';
// import { BackendRequirementHandler } from '../requirements-document';
// import { Logger } from '@nestjs/common';
// import { VirtualDirectory } from 'src/build-system/virtual-dir';
// import { generateFilesDependencyWithLayers } from 'src/build-system/utils/file_generator_util';
// import { BackendFileStructureAndArchitectureHandler } from '../../file-manager/backend-file-struct';
// import path from 'path';
// import {
//   createFileWithRetries,
//   readFileWithRetries,
// } from 'src/build-system/utils/files';
// import { MessageInterface } from 'src/common/model-provider/types';
// import normalizePath from 'normalize-path';

// interface FileInfos {
//   [fileName: string]: {
//     dependsOn: string[];
//   };
// }

// /**
//  * BackendCodeHandler is responsible for generating the backend codebase
//  * based on the provided sitemap and data mapping documents.
//  */

// @BuildNode()
// @BuildNodeRequire([
//   UXSMDHandler,
//   UXDMDHandler,
//   DBSchemaHandler,
//   BackendRequirementHandler,
//   BackendFileStructureAndArchitectureHandler,
// ])
// export class BackendCodeHandler implements BuildHandler<string> {
//   readonly logger: Logger = new Logger('FrontendCodeHandler');
//   private virtualDir: VirtualDirectory;

//   async run(context: BuilderContext): Promise<BuildResult<string>> {
//     const projectName =
//       context.getGlobalContext('projectName') || 'Default Project Name';
//     const databaseType =
//       context.getGlobalContext('databaseType') || 'Default database type';
//     // Retrieve required documents
//     const sitemapDoc = context.getNodeData(UXSMDHandler);
//     const datamapDoc = context.getNodeData(UXDMDHandler);
//     const databaseSchemas = context.getNodeData(DBSchemaHandler);
//     const backendRequirementDoc =
//       context.getNodeData(BackendRequirementHandler)?.overview || '';

//     const fileArchDoc = context.getNodeData(
//       BackendFileStructureAndArchitectureHandler,
//     );
//     this.logger.log('fileArchDoc', fileArchDoc);

//     this.virtualDir = context.virtualDirectory;
//     const backendPath = context.getGlobalContext('backendPath');

//     // Validate required data
//     if (!sitemapDoc || !datamapDoc || !databaseSchemas) {
//       throw new MissingConfigurationError(
//         `Missing required configuration: sitemapDoc, datamapDoc, or databaseSchemas: siteMapDoc: ${!!sitemapDoc}, datamapDoc: ${!!datamapDoc}, databaseSchemas: ${!!databaseSchemas}`,
//       );
//     }

//     if (!databaseSchemas) {
//       throw new InvalidParameterError(
//         'databaseSchemas should be a valid object.',
//       );
//     }

//     const dependencyFile = 'dependencies.json';

//     const { concurrencyLayers, fileInfos } =
//       await generateFilesDependencyWithLayers(fileArchDoc, this.virtualDir);

//     // const validator = new FrontendCodeValidator(frontendPath);
//     const generatedCode = '';

//     for (const [layerIndex, layer] of concurrencyLayers.entries()) {
//       this.logger.log(
//         `\n==== Concurrency Layer #${layerIndex + 1} ====\nFiles: [${layer.join(
//           ', ',
//         )}]\n`,
//       );

//       // const queue = new CodeTaskQueue();

//       const maxRetries = 3; // Maximum retry attempts per file
//       const delayMs = 200; // Delay between retries for a file
//       const remainingFiles = [...layer]; // Start with all files in the layer

//       for (
//         let attempt = 1;
//         attempt <= maxRetries && remainingFiles.length > 0;
//         attempt++
//       ) {
//         const failedFiles: any[] = [];

//         await Promise.all(
//           remainingFiles.map(async (file) => {
//             this.logger.log(
//               `Layer #${layerIndex + 1}, generating code for file: ${file}`,
//             );

//             const currentFullFilePath = path.resolve(backendPath, file);

//             // Generate the prompt using the provided documents and project name
//             const backendCodePrompt = generateBackendCodePrompt(
//               projectName,
//               databaseType,
//               currentFullFilePath,
//               'javascript', // TODO: make sure this lang come from the context
//               dependencyFile,
//             );

//             // Ensure fileInfos[file] exists before modifying
//             if (!fileInfos[file]) {
//               fileInfos[file] = {
//                 filePath: file, // Assuming `file` is the correct path
//                 dependsOn: [],
//               };
//             }

//             const directDepsPathString = fileInfos[file].dependsOn.join('\n');

//             const dependenciesText = await this.gatherDependenciesForFile(
//               file,
//               fileInfos,
//               backendPath,
//             );

//             const messages = [
//               {
//                 role: 'system' as const,
//                 content: backendCodePrompt,
//               },
//               {
//                 role: 'user' as const,
//                 content: `## Database Schema:
//                           ${databaseSchemas}
//                           `,
//               },
//               {
//                 role: 'user' as const,
//                 content: `## Backend Requirement:
//                           ${backendRequirementDoc}
//                           `,
//               },
//               {
//                 role: 'assistant',
//                 content:
//                   "Good, now provider your dependencies, it's okay dependencies are empty, which means you don't have any dependencies",
//               },
//               {
//                 role: 'user' as const,
//                 content: `

//                       ## Overview of The Internal Dependencies filess you may need
//                         ${directDepsPathString}

//                       ## Detail about each Internal Dependencies:
//                         ${dependenciesText}\n
//                               `,
//               },
//               {
//                 role: 'user',
//                 content: `Now you can provide the code, don't forget the <GENERATE></GENERATE> tags. Do not be lazy.`,
//               },
//               // {
//               //   role: 'assistant',
//               //   content: codeReviewPrompt,
//               // },
//             ] as MessageInterface[];

//             let generatedCode: string;
//             try {
//               const modelResponse = await chatSyncWithClocker(
//                 context,
//                 {
//                   model: 'gpt-4o-mini',
//                   messages: messages,
//                 },
//                 'generateBackendCode',
//                 BackendCodeHandler.name,
//               );

//               generatedCode = formatResponse(modelResponse);

//               if (!generatedCode) {
//                 throw new ResponseParsingError(
//                   'Response tag extraction failed.',
//                 );
//               }
//             } catch (error) {
//               if (error instanceof ResponseParsingError) {
//                 throw error;
//               }
//               throw new ResponseParsingError(
//                 'Error occurred while parsing the model response.',
//               );
//             }

//             try {
//               await createFileWithRetries(currentFullFilePath, generatedCode);
//             } catch (error) {
//               throw new FileWriteError(
//                 `Failed to save backend code to ${backendPath}: ${error.message}`,
//               );
//             }
//           }),
//         );
//       }

//       // Now process the entire queue for this layer:
//       // This writes each file, runs build, fixes if needed, etc.
//       // const queueProcessor = new FrontendQueueProcessor(
//       //   validator,
//       //   queue,
//       //   context,
//       //   frontendPath,
//       //   renameMap,
//       // );
//       // await queueProcessor.processAllTasks();
//       // this.logger.log(
//       //   `\n==== Finished concurrency layer #${layerIndex + 1} ====\n`,
//       // );
//     }

//     return {
//       success: true,
//       data: generatedCode,
//     };
//   }

//   // get the dependencies content and path
//   private async gatherDependenciesForFile(
//     file: string,
//     fileInfos: FileInfos,
//     frontendPath: string,
//   ): Promise<string> {
//     const directDepsArray = fileInfos[file]?.dependsOn ?? [];
//     let dependenciesText = '';

//     for (const dep of directDepsArray) {
//       try {
//         const resolvedDepPath = normalizePath(path.resolve(frontendPath, dep));
//         const depContent = await readFileWithRetries(resolvedDepPath, 3, 200);
//         dependenciesText += `\n\n<dependency>  File path: ${dep}\n\`\`\`typescript\n${depContent}\n\`\`\`\n</dependency>`;
//       } catch (err) {
//         this.logger.warn(
//           `Failed to read dependency "${dep}" for file "${file}"`,
//           err,
//         );
//       }
//     }

//     return dependenciesText;
//   }
// }
