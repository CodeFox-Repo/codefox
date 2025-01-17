import { Logger } from '@nestjs/common';
import { BuilderContext } from 'src/build-system/context';
import { BuildHandler, BuildResult } from 'src/build-system/types';
import { prompts } from './prompt';
import { removeCodeBlockFences } from 'src/build-system/utils/strings';
import {
  batchChatSyncWithClock,
  chatSyncWithClocker,
} from 'src/build-system/utils/handler-helper';
import { MessageInterface } from 'src/common/model-provider/types';
import {
  MissingConfigurationError,
  ResponseParsingError,
} from 'src/build-system/errors';
import { OpenAIModelProvider } from 'src/common/model-provider/openai-model-provider';

export class Level2UXSitemapStructureHandler implements BuildHandler<string> {
  readonly id = 'op:UX:SMS:LEVEL2';
  private readonly logger = new Logger('Level2UXSitemapStructureHandler');

  async run(context: BuilderContext): Promise<BuildResult<string>> {
    this.logger.log('Generating Level 2 UX Sitemap Structure Document...');

    const projectName =
      context.getGlobalContext('projectName') || 'Default Project Name';
    const sitemapDoc = context.getNodeData('op:UX:SMS');
    const uxStructureDoc = context.getNodeData('op:UX:SMS');

    // Validate required data
    if (!projectName || typeof projectName !== 'string') {
      throw new MissingConfigurationError('Missing or invalid projectName.');
    }
    if (!sitemapDoc || typeof sitemapDoc !== 'string') {
      throw new MissingConfigurationError(
        'Missing or invalid sitemap document.',
      );
    }
    if (!uxStructureDoc || typeof uxStructureDoc !== 'string') {
      throw new MissingConfigurationError(
        'Missing or invalid UX Structure document.',
      );
    }

    const normalizedUxStructureDoc = uxStructureDoc.replace(/\r\n/g, '\n');

    // Extract sections from the UX Structure Document
    const sections = this.extractAllSections(normalizedUxStructureDoc);

    if (sections.length === 0) {
      this.logger.error(
        'No valid sections found in the UX Structure Document.',
      );
      throw new ResponseParsingError(
        'No valid sections found in the UX Structure Document.',
      );
    }

    // Process all sections concurrently
    const modelProvider = OpenAIModelProvider.getInstance();

    // Prepare all requests
    const requests = sections.map((section) => ({
      model: 'gpt-4o-mini',
      messages: [
        {
          content: prompts.generateLevel2UXSiteMapStructrePrompt(
            projectName,
            section.content,
            sitemapDoc,
            'web', // TODO: Replace with dynamic platform if necessary
          ),
          role: 'system' as const,
        },
      ],
    }));

    const refinedSections = await batchChatSyncWithClock(
      context,
      'generate page-by-page by sections',
      this.id,
      requests,
    );

    // TODO: deal with chat clocker
    // Combine the refined sections into the final document
    const refinedDocument = refinedSections.join('\n\n');

    this.logger.log(
      'Successfully generated Level 2 UX Sitemap Structure document.',
    );

    return {
      success: true,
      data: removeCodeBlockFences(refinedDocument),
    };
  }

  /**
   * Extracts all sections from a given text.
   * @param text The UX Structure Document content.
   * @returns Array of extracted sections with title and content.
   */
  private extractAllSections(
    text: string,
  ): Array<{ title: string; content: string }> {
    // Updated regex to handle optional numbering and use multiline flag
    const regex =
      /^##\s+(?:\d+(?:\.\d+)?\s+)?(.*?)(?=\r?\n##|$)([\s\S]*?)(?=\r?\n##|$)/gm;
    const sections = [];
    let match = regex.exec(text);
    let nextMatch;

    while ((nextMatch = regex.exec(text)) !== null) {
      const content = text.slice(match.index, nextMatch.index).trim();
      const title = match[1].trim();
      match = nextMatch;
      sections.push({ title, content });
    }
    if (match) {
      const content = text.slice(match.index).trim();
      const title = match[1].trim();
      sections.push({ title, content });
    }

    if (sections.length === 0) {
      this.logger.warn('No sections found in the UX Structure document.');
    }

    return sections;
  }
}
