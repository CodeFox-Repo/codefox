import { BuildHandler, BuildResult } from 'src/build-system/types';
import { BuilderContext } from 'src/build-system/context';
import { prompts } from './prompt';
import { Logger } from '@nestjs/common';
import { removeCodeBlockFences } from 'src/build-system/utils/strings';
import { chatSyncWithClocker } from 'src/build-system/utils/handler-helper';
import { MessageInterface } from 'src/common/model-provider/types';
import {
  MissingConfigurationError,
  ModelUnavailableError,
  ResponseParsingError,
} from 'src/build-system/errors';
import { BuildNode } from 'src/build-system/hanlder-manager';

@BuildNode()
export class PRDHandler implements BuildHandler<string> {
  readonly logger: Logger = new Logger('PRDHandler');

  async run(context: BuilderContext): Promise<BuildResult<string>> {
    this.logger.log('Generating PRD...');

    // Extract project data from the context
    const projectName =
      context.getGlobalContext('projectName') || 'Default Project Name';
    const description =
      context.getGlobalContext('description') || 'Default Description';
    const platform = context.getGlobalContext('platform') || 'web';

    // Validate extracted data
    if (!projectName || typeof projectName !== 'string') {
      throw new MissingConfigurationError('Missing or invalid projectName.');
    }
    if (!description || typeof description !== 'string') {
      throw new MissingConfigurationError('Missing or invalid description.');
    }
    if (!platform || typeof platform !== 'string') {
      throw new MissingConfigurationError('Missing or invalid platform.');
    }

    // Generate the prompt dynamically
    const prompt = prompts.generatePRDPrompt(
      projectName,
      description,
      platform,
    );

    try {
      // Send the prompt to the LLM server and process the response
      const prdContent = await this.generatePRDFromLLM(context, prompt);

      // Extract the "Project Overview" section
      const projectOverview = this.extractProjectOverviewSection(prdContent);

      // Extract the "Features" section
      const features = this.extractFeaturesSection(prdContent);

      // Set the extracted overview to a global context variable
      if (projectOverview) {
        context.setGlobalContext('projectOverview', projectOverview);
        this.logger.log(
          'Project Overview extracted and set to global context',
          projectOverview,
        );
      } else {
        this.logger.warn('Could not extract Project Overview section');
      }

      if (features) {
        context.setGlobalContext('projectFeatures', features);
        this.logger.log(
          'Features section extracted and set to global context',
          features,
        );
      } else {
        this.logger.warn('Could not extract Features section');
      }

      if (!prdContent || prdContent.trim() === '') {
        throw new ResponseParsingError('Generated PRD content is empty.');
      }

      return {
        success: true,
        data: removeCodeBlockFences(prdContent),
      };
    } catch (error) {
      this.logger.error('Error during PRD generation:', error);
      throw new ResponseParsingError('Failed to generate PRD.');
    }
  }
  private async generatePRDFromLLM(
    context: BuilderContext,
    prompt: string,
  ): Promise<string> {
    try {
      const messages: MessageInterface[] = [
        { content: prompt, role: 'system' },
      ];
      const prdContent = await chatSyncWithClocker(
        context,
        { messages, model: context.defaultModel || 'gpt-4o-mini' },
        'generatePRDFromLLM',
        PRDHandler.name,
      );
      if (!prdContent || prdContent.trim() === '') {
        throw new ModelUnavailableError(
          'LLM server returned empty PRD content.',
        );
      }

      this.logger.log('Received full PRD content from LLM server.');
      return prdContent;
    } catch (error) {
      throw new ModelUnavailableError('Model is unavailable: ' + error);
    }
  }

  /**
   * Extracts a specific section from the PRD content by section title
   * @param prdContent The full PRD content
   * @param sectionNumber The section number (e.g., "1" for "#### 1. Project Overview")
   * @param sectionTitle The section title (e.g., "Project Overview")
   * @returns The extracted section content or null if not found
   */
  private extractSection(
    prdContent: string,
    sectionNumber: string,
    sectionTitle: string,
  ): string | null {
    try {
      // Define regex pattern to match the specified section
      // This pattern matches from "#### [sectionNumber]. [sectionTitle]" until the next "####" heading
      const pattern = new RegExp(
        `#### ${sectionNumber}\\.\\s*${sectionTitle}([\\s\\S]*?)(?=####|$)`,
      );
      const match = prdContent.match(pattern);

      if (match && match[1]) {
        // Trim the extracted content to remove leading/trailing whitespace
        return match[1].trim();
      }

      // If no match found, try an alternative approach with just the title
      const simplifiedPattern = new RegExp(
        `#### (?:${sectionNumber}\\.)?\\s*${sectionTitle}([\\s\\S]*?)(?=####|$)`,
      );
      const simplifiedMatch = prdContent.match(simplifiedPattern);

      if (simplifiedMatch && simplifiedMatch[1]) {
        return simplifiedMatch[1].trim();
      }

      this.logger.warn(`Could not find ${sectionTitle} section in PRD content`);
      return null;
    } catch (error) {
      this.logger.error(`Error extracting ${sectionTitle} section:`, error);
      return null;
    }
  }

  /**
   * Extracts the "Project Overview" section from the PRD content
   * @param prdContent The full PRD content
   * @returns The extracted project overview section or null if not found
   */
  private extractProjectOverviewSection(prdContent: string): string | null {
    return this.extractSection(prdContent, '1', 'Project Overview');
  }

  /**
   * Extracts the "Features" section from the PRD content
   * @param prdContent The full PRD content
   * @returns The extracted features section or null if not found
   */
  private extractFeaturesSection(prdContent: string): string | null {
    return this.extractSection(prdContent, '5', 'Features');
  }
}
