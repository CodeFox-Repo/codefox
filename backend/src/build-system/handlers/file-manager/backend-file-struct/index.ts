import { BuildHandler, BuildOpts, BuildResult } from 'src/build-system/types';
import { BuilderContext } from 'src/build-system/context';
import { Logger } from '@nestjs/common';
import {
  parseGenerateTag,
  removeCodeBlockFences,
  extractJsonFromText,
  formatResponse,
} from 'src/build-system/utils/strings';
import { chatSyncWithClocker } from 'src/build-system/utils/handler-helper';
import {
  ResponseParsingError,
  MissingConfigurationError,
  InvalidParameterError,
  ModelUnavailableError,
} from 'src/build-system/errors';
import { BuildNode, BuildNodeRequire } from 'src/build-system/hanlder-manager';
import { VirtualDirectory } from 'src/build-system/virtual-dir';
import {
  buildDependencyGraph,
  validateAgainstVirtualDirectory,
} from 'src/build-system/utils/file_generator_util';
import { BackendRequirementHandler } from '../../backend/requirements-document';
import { DBSchemaHandler } from '../../database/schemas/schemas';

export const prompts = {
  convertTreeToJsonPrompt: (): string => {
    return `You are a highly skilled developer. Your task is to convert the previous file and folder structure, currently represented in an ASCII tree format, into a JSON structure. The JSON structure must:
  
  - Represent all file paths in a flat list under the "Paths" array.
  - Each file path must be a relative path that begins exactly with "src/" (do not include any leading "/" or absolute paths).
  - Directories should not be included—only file paths.
  
  Output Format:
  Return a JSON object in the following format:
  Surround the JSON object with <GENERATE> tags.
  
  <GENERATE>
  {
    "Paths": [
      "src/full/path/to/file1.ext",
      "src/full/path/to/file2.ext",
      "src/another/path/to/file3.ext"
    ]
  }
  </GENERATE>
  
  Additional Rules:
  
  - Maintain the original directory structure but only return files in the JSON output.
  - Keep file names and paths exactly as they appear in the ASCII tree.
  - **Important**: Ensure that all file paths are relative and begin exactly with "src/". Do not output any paths that start with a leading "/".
  - Do not include comments or extra fields besides "Paths".
  - Return only the JSON structure (no explanations, no additional comments). This JSON will be used directly in the application.
  `;
  },

  generateCommonFileStructurePrompt: (
    projectName: string,
    DBSchema: string,
    BackendRequirementDoc: string,
    framework: string,
    projectPart: string,
    projectSize: string,
  ): string => {
    let roleDescription = '';
    let includeSections = '';
    let excludeSections = '';
    let fileNamingGuidelines = '';
    let projectSizeNote = '';

    // Set project size note
    switch (projectSize.toLowerCase()) {
      case 'small':
        projectSizeNote = `* Note: For a small project, generate a minimal backend structure that only includes the essential files and folders.`;
        break;
      case 'medium':
        projectSizeNote = `* Note: For a medium project, generate a backend structure that covers all necessary endpoints and models with moderate detail.`;
        break;
      case 'large':
        projectSizeNote = `* Note: For a large project, generate a comprehensive backend structure including all routes, controllers, models, and utilities.`;
        break;
      default:
        projectSizeNote = `* Note: The project size is unspecified. Please use a balanced approach.`;
    }

    // Backend-specific configuration
    roleDescription = 'an expert backend developer';

    // Default backend structure for all project sizes
    includeSections = `
      Folder Structure:
        src/
            controllers/ - Handle incoming requests and return responses
            models/ - Define data schemas and interact with the database
            route.ts - Define API endpoints and route requests to controllers
    `;

    excludeSections = `
      Do Not Include:
        - Frontend-specific folders (e.g., components, pages, contexts)
        - Asset folders (e.g., images, icons, fonts)
        - Test folders or files (tests will be generated separately)
    `;

    fileNamingGuidelines = `
      File Naming Guidelines:
        - Use meaningful and descriptive file names
        - Controllers should be named after their resource (e.g., userController.ts)
        - Models should represent data entities (e.g., User.ts)
        - Use consistent naming conventions (camelCase) throughout the project
        - Match model names to the database schema entities
    `;

    return `You are ${roleDescription}. Your task is to generate a complete folder and file structure for the backend of a project named "${projectName}". Include all necessary files and folders to cover the essential aspects while ensuring scalability and maintainability.
  
  Based on the following input:
  
  - Project name: ${projectName}
  - Database Schema (provided below)
  - Backend Requirements Doc (provided below)
  - Framework: ${framework}
  
  ${projectSizeNote}
  
  ### Instructions and Rules:
  
  Include:
  ${includeSections}
  
  ${fileNamingGuidelines}
  
  ${excludeSections}

  File Comments:
    Include comments describing the purpose of each file or folder to improve readability.
  
  Consider the following when generating the structure:
  1. Analyze the backend requirements to identify all required API endpoints
  2. Use the database schema to identify all required models
  3. For each endpoint in the requirements, ensure there's a corresponding controller method
  4. Create appropriate model files for each entity in the database schema
  5. Ensure proper separation of concerns with controllers handling request/response and business logic in the appropriate location
  
  This final result must be 100% complete and ready for direct use in production.

  Output Format:
  
  Start with: "\`\`\`FolderStructure"
  Tree format:
      Include folder names with placeholder files inside.
      Add comments to describe the purpose of each file/folder.
  End with: "\`\`\`"
  `;
  },

  generateFileArchPrompt: (): string => {
    return `Your task is to analyze the given project directory structure and create a detailed JSON object mapping file dependencies. The output JSON must be precisely formatted and wrapped in <GENERATE></GENERATE> tags.

### Instructions

1. **Analyze the directory structure** to identify all files and their relationships in this Express backend application.
   - Identify direct dependencies for each file by considering typical imports based on roles, naming conventions, and the provided analysis.
   - Understand the MVC pattern used in Express.js applications (Models, Controllers, Routes)
   - Do not assume any additional files or paths. The structure must be based exclusively on the given list.
   
2. **Generate File Dependency JSON**:
   - Each file must be represented using its full path starting from src/.
   - Ensure dependencies are strictly limited to files in the "Paths" array.
   - Use absolute file paths from "Paths" for all "dependsOn" values.
      Do not use relative paths (./, ../).
      Every dependency must match exactly one of the files in "Paths".
   - Any file without dependencies should have "dependsOn": [].
   - For each file, list its direct dependencies as an array of relative paths in the \`dependsOn\` field.
   - Organize the output in a \`files\` object where keys are file paths, and values are their dependency objects.

3. **Output Requirements**:
   - The JSON object must strictly follow this structure:
     \`\`\`json
     <GENERATE>
     {
       "files": {
         "src/path/to/file1": {
           "dependsOn": ["src/path/to/dependency1", "src/path/to/dependency2"]
         },
         "src/path/to/file2": {
           "dependsOn": []
         }
       }
     }
     </GENERATE>
     \`\`\`
   - Keys: Every file must be represented with its full path, starting from src/.
   - Dependency Rules:
     All dependencies must exist in the "Paths" array.
     No inferred or assumed files should be added.
   - Wrap the JSON output with \`<GENERATE></GENERATE>\` tags.
### Notes
- The \`dependsOn\` field should reflect logical dependencies inferred from both the directory structure and the page-by-page analysis.
- Include all files in the output, even if they have no dependencies.
- For database models, consider entity relationships when determining dependencies.
- The route file should depend on controllers, not directly on models.
- Controllers should depend on the models they interact with.

### Output
Return only the JSON object wrapped in \`<GENERATE></GENERATE>\` tags.
`;
  },
};

@BuildNode()
@BuildNodeRequire([DBSchemaHandler, BackendRequirementHandler])
export class BackendFileStructureAndArchitectureHandler
  implements BuildHandler<string>
{
  readonly id = 'op:FILE:STRUCT_AND_ARCH';
  private readonly logger: Logger = new Logger(
    'FileStructureAndArchitectureHandler',
  );
  private virtualDir: VirtualDirectory;

  async run(
    context: BuilderContext,
    opts?: BuildOpts,
  ): Promise<BuildResult<string>> {
    this.logger.log('Generating File Structure Document...');

    const projectName =
      context.getGlobalContext('projectName') || 'Default Project Name';
    const backendRequirementDoc = context.getNodeData(
      BackendRequirementHandler,
    );
    const dbSchema = context.getNodeData(DBSchemaHandler);
    const projectPart = opts?.projectPart ?? 'backend';
    const framework = context.getGlobalContext('framework') ?? 'Express';
    const projectSize = context.getGlobalContext('projectSize') || 'small';

    try {
      this.validateInputs(
        backendRequirementDoc,
        dbSchema,
        framework,
        projectPart,
      );
    } catch (error) {
      return {
        success: false,
        error,
      };
    }

    const fileStructPrompt = prompts.generateCommonFileStructurePrompt(
      projectName,
      dbSchema,
      backendRequirementDoc,
      framework,
      projectPart,
      projectSize,
    );
    const convertToJsonPrompt = prompts.convertTreeToJsonPrompt();

    const fileStructMessages = [
      {
        role: 'system' as const,
        content: fileStructPrompt,
      },
      {
        role: 'user' as const,
        content: `
          **Backend Requirement Documentation**
          ${backendRequirementDoc}
          `,
      },
      {
        role: 'user' as const,
        content: `
          **DataBase Schema**
          ${dbSchema}

          Now please generate tree folder structure.
         `,
      },
      {
        role: 'system' as const,
        content: convertToJsonPrompt,
      },
      {
        role: 'user' as const,
        content: `**Final Check:**
      Before returning the output, ensure the following:
      - The JSON structure is correctly formatted and wrapped in <GENERATE></GENERATE> tags.
      - File extensions and paths match those in the Directory Structure.
      - All files and dependencies are included, with relative paths used wherever possible.`,
      },
    ];

    let fileStructureContent: string;
    try {
      fileStructureContent = await chatSyncWithClocker(
        context,
        {
          model: context.defaultModel || 'gpt-4o-mini',
          messages: fileStructMessages,
        },
        'generateCommonFileStructure',
        this.id,
      );
      this.logger.debug('fileStructureContent', fileStructureContent);

      if (!fileStructureContent || fileStructureContent.trim() === '') {
        throw new ResponseParsingError(
          `Generated content is empty during op:FILE:STRUCT_AND_ARCH.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate file structure: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: new ResponseParsingError(
          `File structure generation failed. ${error.message}`,
        ),
      };
    }

    let fileStructureJsonContent = '';
    try {
      fileStructureJsonContent = parseGenerateTag(fileStructureContent);
    } catch (error) {
      return {
        success: false,
        error: new ResponseParsingError(
          `Failed to parse file Structure Json Content. ${error.message}`,
        ),
      };
    }

    this.logger.log('Building virtual directory from file structure...');
    try {
      const successBuild = context.buildVirtualDirectory(
        fileStructureJsonContent,
      );
      if (!successBuild) {
        this.logger.error(
          'Failed to build virtual directory.' + fileStructureJsonContent,
        );
        throw new ResponseParsingError('Failed to build virtual directory.');
      }
    } catch (error) {
      return {
        success: false,
        error: new ResponseParsingError(
          `Failed to build virtual directory. ${error.message}`,
        ),
      };
    }

    context.virtualDirectory.getAllFiles().forEach((file) => {
      this.logger.log(file);
    });

    this.logger.log('File Structure Document generated successfully.');

    this.logger.log('Generating File Architecture Document...');

    this.virtualDir = context.virtualDirectory;
    const fileStructure = removeCodeBlockFences(fileStructureContent);
    if (!fileStructure) {
      return {
        success: false,
        error: new InvalidParameterError(
          `Missing required parameters: fileStructure, current fileStructure: ${!!fileStructure}`,
        ),
      };
    }

    const fileArchPrompt = prompts.generateFileArchPrompt();

    let invalidFiles = 'none';
    let fileArchContent: string;

    while (invalidFiles) {
      const fileArchMessages = [
        {
          role: 'system' as const,
          content: fileArchPrompt,
        },
        {
          role: 'user' as const,
          content: `
          **Page-by-Page Analysis**
          The following is a detailed analysis of each page. Use this information to understand specific roles, interactions, and dependencies.

          ${backendRequirementDoc}

          Next, I will provide the **Directory Structure** to help you understand the full project architecture.`,
        },
        {
          role: 'user' as const,
          content: `
          **Directory Structure**:
          The following is the project's directory structure. Use this to identify files and folders.

          ${fileStructure}

          Based on this structure and the analysis provided earlier, please generate the File Architecture JSON object. Ensure the output adheres to all rules and guidelines specified in the system prompt.
          `,
        },
        {
          role: 'user' as const,
          content: `**Final Check**
      Before returning the output, ensure the following:
      - The JSON structure is correctly formatted and wrapped in <GENERATE></GENERATE> tags.
      - File extensions and paths match those in the Directory Structure.
      - All files and dependencies are included.
      `,
        },
        {
          role: 'user' as const,
          content:
            "here is the invalid file, trying to fix it, if it's none, then you can ignore it: " +
            invalidFiles,
        },
      ];

      try {
        fileArchContent = await chatSyncWithClocker(
          context,
          {
            model: context.defaultModel || 'gpt-4o-mini',
            messages: fileArchMessages,
          },
          'generateFileArch',
          this.id,
        );
      } catch (error) {
        this.logger.error('Model is unavailable:' + error);
        return {
          success: false,
          error: new ModelUnavailableError('Model is unavailable:' + error),
        };
      }

      const tagContent = parseGenerateTag(fileArchContent);
      const jsonData = extractJsonFromText(tagContent);

      if (!jsonData) {
        this.logger.error('Failed to extract JSON from text');
        throw new ResponseParsingError('Failed to extract JSON from text.');
      }

      if (!this.validateJsonData(jsonData)) {
        this.logger.error('File architecture JSON validation failed.');
        throw new ResponseParsingError(
          'File architecture JSON validation failed.',
        );
      }

      const { nodes } = buildDependencyGraph(jsonData);
      invalidFiles = validateAgainstVirtualDirectory(nodes, this.virtualDir);
      if (invalidFiles) {
        this.logger.warn('arch json content', fileArchContent);
        this.logger.warn(
          'Validation against virtual directory failed. here is the invalid file, trying to fix it',
          invalidFiles,
        );
      }
    }

    this.logger.log('File architecture document generated successfully.');
    return {
      success: true,
      data: formatResponse(fileArchContent),
    };
  }

  private validateInputs(
    dbSchema: any,
    backendRequirementDoc: any,
    framework: string,
    projectPart: string,
  ): void {
    if (!backendRequirementDoc || typeof backendRequirementDoc !== 'string') {
      throw new MissingConfigurationError(
        'Missing or invalid backendRequirementDoc.',
      );
    }
    if (!dbSchema || typeof dbSchema !== 'string') {
      throw new MissingConfigurationError('Missing or invalid dbSchema.');
    }
    if (!framework || typeof framework !== 'string') {
      throw new MissingConfigurationError('Missing or invalid framework.');
    }
    if (!['frontend', 'backend'].includes(projectPart)) {
      throw new MissingConfigurationError(
        'Invalid projectPart. Must be either "frontend" or "backend".',
      );
    }
  }

  private validateJsonData(jsonData: {
    files: Record<string, { dependsOn: string[] }>;
  }): boolean {
    const validPathRegex = /^[a-zA-Z0-9_\-/.]+$/;

    for (const [file, details] of Object.entries(jsonData.files)) {
      if (!validPathRegex.test(file)) {
        this.logger.error(`Invalid file path: ${file}`);
        return false;
      }

      for (const dependency of details.dependsOn) {
        if (!validPathRegex.test(dependency)) {
          this.logger.error(
            `Invalid dependency path "${dependency}" in file "${file}".`,
          );
          return false;
        }

        if (dependency.includes('//') || dependency.endsWith('/')) {
          this.logger.error(
            `Malformed dependency path "${dependency}" in file "${file}".`,
          );
          return false;
        }
      }
    }
    return true;
  }
}
