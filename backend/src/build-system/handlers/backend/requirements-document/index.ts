import { BuildHandler, BuildResult } from 'src/build-system/types';
import { BuilderContext } from 'src/build-system/context';
import { generateBackendOverviewPrompt } from './prompt';
import { Logger } from '@nestjs/common';
import { removeCodeBlockFences } from 'src/build-system/utils/strings';
import {
  MissingConfigurationError,
  ModelUnavailableError,
} from 'src/build-system/errors';
import { chatSyncWithClocker } from 'src/build-system/utils/handler-helper';
import { BuildNode, BuildNodeRequire } from 'src/build-system/hanlder-manager';
import { DBRequirementHandler } from '../../database/requirements-document';
import { UXDMDHandler } from '../../ux/datamap';
import { DBSchemaHandler } from '../../database/schemas/schemas';
import { MessageInterface } from 'src/common/model-provider/types';

type BackendRequirementResult = {
  overview: string;
  implementation: string;
  config: {
    language: string;
    framework: string;
    packages: Record<string, string>;
  };
};

/**
 * BackendRequirementHandler is responsible for generating the backend requirements document.
 * Core Content Generation: API Endpoints, System Overview
 */

@BuildNode()
@BuildNodeRequire([DBRequirementHandler, DBSchemaHandler])
export class BackendRequirementHandler implements BuildHandler<string> {
  private readonly logger: Logger = new Logger('BackendRequirementHandler');

  async run(context: BuilderContext): Promise<BuildResult<string>> {
    this.logger.log('Generating Backend Requirements Document...');

    const language = context.getGlobalContext('language') || 'javascript';
    const framework = context.getGlobalContext('framework') || 'express';
    const packages = context.getGlobalContext('packages') || {};
    const projectName =
      context.getGlobalContext('projectName') || 'Default Project Name';

    const dbRequirements = context.getNodeData(DBRequirementHandler);
    const datamapDoc = context.getNodeData(UXDMDHandler);
    const dbSchema = context.getNodeData(DBSchemaHandler);

    if (!dbRequirements || !datamapDoc || !dbSchema) {
      this.logger.error(
        'Missing required parameters: dbRequirements, datamapDoc, or dbSchema',
      );
      throw new MissingConfigurationError(
        'Missing required parameters: dbRequirements, datamapDoc, or dbSchema.',
      );
    }

    const overviewPrompt = generateBackendOverviewPrompt(
      projectName,
      language,
      framework,
      packages,
    );

    const messages = [
      {
        role: 'system' as const,
        content: overviewPrompt,
      },
      {
        role: 'user' as const,
        content: `## Database Requirements:
            ${dbRequirements}
                              `,
      },
      {
        role: 'user' as const,
        content: `## DataBase Schema:
            ${dbSchema}
                              `,
      },
      {
        role: 'user' as const,
        content: `## Frontend Data Requirements:
            ${datamapDoc} `,
      },
      {
        role: 'user',
        content: `Now you can provide the code, don't forget the <GENERATE></GENERATE> tags. Do not be lazy.`,
      },
    ] as MessageInterface[];

    let backendOverview: string;

    try {
      backendOverview = await chatSyncWithClocker(
        context,
        {
          model: 'gpt-4o-mini',
          messages: messages,
        },
        'generateBackendOverviewPrompt',
        BackendRequirementHandler.name,
      );
    } catch (error) {
      throw new ModelUnavailableError('Model is unavailable:' + error);
    }

    // Return generated data
    return {
      success: true,
      data: removeCodeBlockFences(backendOverview),
    };
  }
}
