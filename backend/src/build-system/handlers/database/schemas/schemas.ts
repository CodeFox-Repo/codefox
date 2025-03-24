import { BuildHandler, BuildResult } from 'src/build-system/types';
import { BuilderContext } from 'src/build-system/context';
import { Logger } from '@nestjs/common';
import {
  DatabaseType,
  getSchemaFileExtension,
  getSupportedDatabaseTypes,
  isSupportedDatabaseType,
} from '../../../utils/database-utils';
import { prompts } from './prompt';
import { formatResponse } from 'src/build-system/utils/strings';
import { chatSyncWithClocker } from 'src/build-system/utils/handler-helper';
import { FileWriteError, ModelUnavailableError } from 'src/build-system/errors';
import { DBRequirementHandler } from '../requirements-document';
import { BuildNode, BuildNodeRequire } from 'src/build-system/hanlder-manager';
import { CodeValidator } from 'src/build-system/handlers/frontend-code-generate/CodeValidator';
import { saveGeneratedCode } from 'src/build-system/utils/files';
import * as path from 'path';

@BuildNode()
@BuildNodeRequire([DBRequirementHandler])
export class DBSchemaHandler implements BuildHandler {
  private readonly logger: Logger = new Logger('DBSchemaHandler');
  async run(context: BuilderContext): Promise<BuildResult> {
    this.logger.log('Generating Database Schemas...');

    // 1. Get required context data
    const projectName =
      context.getGlobalContext('projectName') || 'Default Project Name';
    const databaseType =
      context.getGlobalContext('databaseType') || 'PostgreSQL';
    const dbRequirements = context.getNodeData(DBRequirementHandler);
    const uuid = context.getGlobalContext('projectUUID');
    const backendPath = context.getGlobalContext('backendPath');

    // 2. Validate database type
    if (!isSupportedDatabaseType(databaseType)) {
      throw new Error(
        `Unsupported database type: ${databaseType}. Supported types are: ${getSupportedDatabaseTypes().join(', ')}.`,
      );
    }

    // 3. Get file extension
    let fileExtension: string;
    try {
      fileExtension = getSchemaFileExtension(databaseType as DatabaseType);
    } catch (error) {
      this.logger.error('Error determining schema file extension:', error);
      throw new FileWriteError(
        `Failed to determine schema file extension for database type: ${databaseType}.`,
      );
    }

    try {
      // Step 1: Analyze database requirements
      this.logger.debug('Starting database requirements analysis...');
      const analysisPrompt = prompts.analyzeDatabaseRequirements(
        projectName,
        dbRequirements,
        databaseType,
      );
      let dbAnalysis: string;
      try {
        const analysisResponse = await chatSyncWithClocker(
          context,
          {
            model: 'gpt-4o-mini',
            messages: [{ content: analysisPrompt, role: 'system' }],
          },
          'analyzeDatabaseRequirements',
          DBSchemaHandler.name,
        );
        dbAnalysis = formatResponse(analysisResponse);
      } catch (error) {
        throw new ModelUnavailableError(
          `Model unavailable during analysis: ${error}`,
        );
      }

      // Step 2: Generate schema based on analysis
      this.logger.debug('Generating database schema...');
      const schemaPrompt = prompts.generateDatabaseSchema(
        dbAnalysis,
        databaseType,
        fileExtension,
      );
      let schemaContent = '';
      try {
        const schemaResponse = await chatSyncWithClocker(
          context,
          {
            model: 'gpt-4o-mini',
            messages: [{ content: schemaPrompt, role: 'system' }],
          },
          'generateDatabaseSchema',
          DBSchemaHandler.name,
        );
        schemaContent = formatResponse(schemaResponse);
      } catch (error) {
        throw new ModelUnavailableError(
          `Model unavailable during schema generation: ${error}`,
        );
      }

      // Step 3: Validate generated schema
      const maxFixAttempts = 2;
      const schemaValidator = new CodeValidator(backendPath, 'sqlite3');
      for (let attempt = 1; attempt <= maxFixAttempts; attempt++) {
        this.logger.debug('Validating generated schema...');

        // Write schema to file
        const schemaFileName = `schema.${fileExtension}`;

        try {
          await saveGeneratedCode(
            path.join(uuid, 'backend', schemaFileName),
            schemaContent,
          );
          this.logger.log(
            `Schema file (${schemaFileName}) written successfully.`,
          );
        } catch (error) {
          throw new FileWriteError(
            `Failed to write schema file: ${error.message}`,
          );
        }

        const validationResult = await schemaValidator.validate();

        if (validationResult.success) {
          this.logger.log(
            `Sqlite3 Schema build succeeded on attempt #${attempt}.`,
          );
          break; // done, move on
        }
        this.logger.warn(
          `Build failed on attempt #${attempt} for file Sqlite3 Schema.`,
        );

        const validationPrompt = prompts.validateDatabaseSchema(
          schemaContent,
          databaseType,
        );
        try {
          const validationResponse = await chatSyncWithClocker(
            context,
            {
              model: 'o3-mini-high',
              messages: [
                { content: validationPrompt, role: 'system' },
                {
                  role: 'user',
                  content: `This is the error ${validationResult.error} 
                  Help me fix my schema code if there is any failed validation, generate full validated version schemas for me, with <GENERATE></GENERATE> xml tag`,
                },
              ],
            },
            'validateDatabaseSchema',
            DBSchemaHandler.name,
          );
          schemaContent = formatResponse(validationResponse);
        } catch (error) {
          throw new ModelUnavailableError(
            `Model unavailable during validation: ${error}`,
          );
        }
      }

      return {
        success: true,
        data: schemaContent,
      };
    } catch (error) {
      this.logger.error('Error in schema generation process:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
