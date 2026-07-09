import { Logger } from '@nestjs/common';
import { ResponseTagError } from '../errors';

const logger = new Logger('common-utils');

export const SHADCN_COMPONENT_PATHS: string[] = [
  '@/components/ui/accordion.tsx',
  '@/components/ui/alert.tsx',
  '@/components/ui/alert-dialog.tsx',
  '@/components/ui/aspect-ratio.tsx',
  '@/components/ui/avatar.tsx',
  '@/components/ui/badge.tsx',
  '@/components/ui/breadcrumb.tsx',
  '@/components/ui/button.tsx',
  '@/components/ui/calendar.tsx',
  '@/components/ui/card.tsx',
  '@/components/ui/carousel.tsx',
  '@/components/ui/chart.tsx',
  '@/components/ui/checkbox.tsx',
  '@/components/ui/collapsible.tsx',
  '@/components/ui/command.tsx',
  '@/components/ui/context-menu.tsx',
  '@/components/ui/dialog.tsx',
  '@/components/ui/drawer.tsx',
  '@/components/ui/dropdown-menu.tsx',
  '@/components/ui/form.tsx',
  '@/components/ui/hover-card.tsx',
  '@/components/ui/input.tsx',
  '@/components/ui/input-otp.tsx',
  '@/components/ui/label.tsx',
  '@/components/ui/menubar.tsx',
  '@/components/ui/navigation-menu.tsx',
  '@/components/ui/pagination.tsx',
  '@/components/ui/popover.tsx',
  '@/components/ui/progress.tsx',
  '@/components/ui/radio-group.tsx',
  '@/components/ui/resizable.tsx',
  '@/components/ui/scroll-area.tsx',
  '@/components/ui/select.tsx',
  '@/components/ui/separator.tsx',
  '@/components/ui/sheet.tsx',
  '@/components/ui/sidebar.tsx',
  '@/components/ui/skeleton.tsx',
  '@/components/ui/slider.tsx',
  '@/components/ui/sonner.tsx',
  '@/components/ui/switch.tsx',
  '@/components/ui/table.tsx',
  '@/components/ui/tabs.tsx',
  '@/components/ui/textarea.tsx',
  '@/components/ui/toast.tsx',
  '@/components/ui/toggle.tsx',
  '@/components/ui/toggle-group.tsx',
  '@/components/ui/tooltip.tsx',
];

/**
 * Function to merge Paths with SHADCN UI component paths
 * and write the result to a new JSON file.
 */
export function mergePaths(input: string) {
  const INDEX_PATH = 'src/index.tsx';
  try {
    // Parse the input string into a JSON object
    const parsedData = JSON.parse(input) as { Paths: string[] };

    // Create a Set to avoid duplicates
    const pathSet = new Set([...parsedData.Paths, ...SHADCN_COMPONENT_PATHS]);

    // Check if src/index.tsx exists, if not, add it
    if (!pathSet.has(INDEX_PATH)) {
      pathSet.add(INDEX_PATH);
    }

    // Convert Set back to array
    const updatedPaths = {
      Paths: Array.from(pathSet),
    };

    // Convert back to JSON string with formatting
    return JSON.stringify(updatedPaths, null, 2);
  } catch (error) {
    console.error('Error parsing JSON input:', error);
    return '{}'; // Return empty object in case of an error
  }
}

/**
 * Extract JSON data from Markdown content.
 * @param markdownContent The Markdown content containing the JSON.
 */
export function extractJsonFromMarkdown(markdownContent: string): {
  files: Record<string, { dependsOn: string[] }>;
} {
  const jsonMatch = /<GENERATE>([\s\S]*?)<\/GENERATE>/m.exec(markdownContent);
  if (!jsonMatch) {
    logger.error('No JSON found in the provided Markdown content.');
    return null;
  }

  try {
    return JSON.parse(jsonMatch[1]);
  } catch (error) {
    logger.error('Invalid JSON format in the Markdown content: ' + error);
    return null;
  }
}

/**
 * Extracts content within <GENERATE> tags from a given string.
 * @param input - The input string containing <GENERATE> tags.
 * @returns The content within the <GENERATE> tags.
 * @throws Error if the <GENERATE> tags are missing or improperly formatted.
 */
export function parseGenerateTag(input: string): string {
  const generateTagRegex = /<GENERATE>([\s\S]*?)<\/GENERATE>/;
  const match = input.match(generateTagRegex);
  if (!match || match.length < 2) {
    throw new ResponseTagError(
      'Invalid format: <GENERATE> tags are missing or improperly formatted.',
    );
  }
  return match[1].trim();
}

/**
 * Removes Markdown code block fences (e.g. ``` or ```javascript) from the given string.
 * This function will remove lines that contain triple backticks, leaving only the actual code content.
 *
 * @param input - The input string potentially containing Markdown code fences.
 * @returns The input string without Markdown code block fences.
 */
export function removeCodeBlockFences(input: string): string {
  return input
    .split('\n')
    .filter((line) => !line.trim().startsWith('```'))
    .join('\n')
    .trim();
}

export function formatResponse(response: string): string {
  try {
    return removeCodeBlockFences(
      parseGenerateTag(removeCodeBlockFences(response)),
    );
  } catch (error) {
    throw new ResponseTagError('Failed to format response: ' + error);
  }
}

export function extractJsonFromText(content: string): {
  files: Record<string, { dependsOn: string[] }>;
} {
  try {
    return JSON.parse(content);
  } catch (error) {
    logger.error('Invalid JSON format in the Markdown content: ' + error);
    throw new ResponseTagError('Failed to extract JSON from text.');
  }
}
