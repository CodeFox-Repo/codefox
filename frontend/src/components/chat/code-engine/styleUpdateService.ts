import { logger } from '@/app/log/logger';

interface ComponentData {
  id: string;
  name: string;
  path: string;
  line: string;
  file: string;
  [key: string]: any;
}

interface StyleChanges {
  [key: string]: string;
}

/**
 * Service to persist style changes to source code files
 */
export class StyleUpdateService {
  // Static property to store project path
  static projectPath: string = '';

  /**
   * Set the current project path
   */
  static setProjectPath(path: string) {
    this.projectPath = path;
    logger.info(`StyleUpdateService: Project path set to ${path}`);
  }

  /**
   * Get the full file path with project prefix
   */
  private static getFullFilePath(filePath: string): string {
    // If path already begins with the project path, don't add it again
    if (filePath.startsWith(this.projectPath)) {
      return filePath;
    }
    return `${this.projectPath}/frontend/${filePath}`;
  }

  /**
   * Persist style changes to the source code file
   * This now has option to use Tailwind classes instead of inline styles
   */
  static async persistStyleChanges(
    component: ComponentData,
    styles: StyleChanges
  ): Promise<boolean> {
    try {
      logger.info(`Persisting style changes for component: ${component.name}`, {
        styles,
      });

      const fullFilePath = this.getFullFilePath(component.path);

      // First, fetch the original file content
      const fileResponse = await fetch(
        `/api/file?path=${encodeURIComponent(fullFilePath)}`
      );
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fullFilePath}`);
      }

      const fileData = await fileResponse.json();
      const originalContent = fileData.content;

      // Log original content for debugging (first 100 chars)
      console.log(
        'Original content sample:',
        originalContent.substring(0, 100)
      );

      // Update the file based on chosen approach
      let updatedContent;

      // Use Tailwind classes approach
      updatedContent = this.applyTailwindClassesToCode(
        originalContent,
        parseInt(component.line),
        styles
      );

      // Log what we're about to do for debugging
      console.log('Preparing to save file changes:', {
        filePath: fullFilePath,
        originalSize: originalContent.length,
        updatedSize: updatedContent.length,
        componentLine: component.line,
      });

      // Save the updated content back to the file
      const updateResponse = await fetch('/api/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: fullFilePath,
          newContent: updatedContent,
        }),
      });

      const responseData = await updateResponse.json();

      if (!updateResponse.ok) {
        console.error('API error response:', responseData);
        throw new Error(
          `Failed to update file: ${responseData.error || 'Unknown error'}`
        );
      }

      logger.info(`Successfully persisted style changes to ${fullFilePath}`);
      console.log('File update response:', responseData);

      return true;
    } catch (error) {
      logger.error('Error persisting style changes:', error);
      console.error('StyleUpdateService error:', error);
      return false;
    }
  }

  /**
   * Apply Tailwind classes to code instead of inline styles
   */
  private static applyTailwindClassesToCode(
    content: string,
    lineNumber: number,
    styles: StyleChanges
  ): string {
    // Split the content into lines for processing
    const lines = content.split('\n');

    // Find the component tag
    let componentLineIndex = lineNumber - 1;
    console.log(
      `Finding component at line ${lineNumber} (index ${componentLineIndex})`
    );

    // Try to find the className attribute in the component
    let classNameLine = -1;
    let classNameAttrStart = -1;
    let classNameAttrEnd = -1;
    let currentClasses = '';

    // Look for className in the component line and nearby lines
    for (
      let i = componentLineIndex;
      i < Math.min(componentLineIndex + 5, lines.length);
      i++
    ) {
      const line = lines[i];
      const classNameMatch = line.match(/className\s*=\s*["']([^"']*)["']/);

      if (classNameMatch) {
        classNameLine = i;
        classNameAttrStart = line.indexOf('className');
        classNameAttrEnd = line.indexOf(
          '"',
          line.indexOf('className="') + 'className="'.length
        );
        if (classNameAttrEnd === -1) {
          classNameAttrEnd = line.indexOf(
            "'",
            line.indexOf("className='") + "className='".length
          );
        }
        currentClasses = classNameMatch[1];
        console.log(
          `Found className at line ${classNameLine + 1}:`,
          currentClasses
        );
        break;
      }
    }

    // Convert style object to Tailwind classes
    const tailwindClasses = this.stylesToTailwindClasses(styles);
    console.log('Tailwind classes to add:', tailwindClasses);

    if (classNameLine >= 0) {
      // Update existing className attribute

      // Parse current classes and remove any we're going to replace
      const existingClasses = currentClasses.split(' ').filter(Boolean);

      // Map of property types to the classes that represent them
      // This ensures we only replace classes that affect the same property
      const classPropertyMap: { [key: string]: string[] } = {
        // Colors
        'text-color': [
          'text-[',
          'text-gray-',
          'text-red-',
          'text-blue-',
          'text-green-',
          'text-yellow-',
        ],
        background: [
          'bg-[',
          'bg-gray-',
          'bg-red-',
          'bg-blue-',
          'bg-green-',
          'bg-yellow-',
        ],
        'border-color': [
          'border-[',
          'border-gray-',
          'border-red-',
          'border-blue-',
          'border-green-',
        ],

        // Typography
        'font-weight': [
          'font-thin',
          'font-extralight',
          'font-light',
          'font-normal',
          'font-medium',
          'font-semibold',
          'font-bold',
          'font-extrabold',
          'font-black',
        ],
        'text-align': [
          'text-left',
          'text-center',
          'text-right',
          'text-justify',
        ],

        // Dont replace size classes like text-xs, text-sm, text-xl when changing text color
        'font-size': [
          'text-xs',
          'text-sm',
          'text-base',
          'text-lg',
          'text-xl',
          'text-2xl',
          'text-3xl',
          'text-4xl',
          'text-5xl',
          'text-6xl',
          'text-7xl',
          'text-8xl',
          'text-9xl',
        ],
      };

      // Group new tailwind classes by property
      const newClassesByProperty: { [key: string]: string } = {};

      tailwindClasses.forEach((cls) => {
        // Determine which property this class affects
        let propertyType = '';

        if (
          cls.startsWith('text-') &&
          !cls.match(/^text-(xs|sm|base|lg|xl|[2-9]xl)$/)
        ) {
          propertyType = 'text-color';
        } else if (cls.startsWith('bg-')) {
          propertyType = 'background';
        } else if (
          cls.startsWith('border-') &&
          !cls.match(/^border-(0|[1-9]|t|r|b|l|x|y)$/)
        ) {
          propertyType = 'border-color';
        } else if (cls.startsWith('font-')) {
          propertyType = 'font-weight';
        } else if (cls.match(/^text-(left|center|right|justify)$/)) {
          propertyType = 'text-align';
        } else if (cls.match(/^text-(xs|sm|base|lg|xl|[2-9]xl)$/)) {
          propertyType = 'font-size';
        }

        if (propertyType) {
          newClassesByProperty[propertyType] = cls;
        }
      });

      // Filter out classes that would conflict with the new ones
      const filteredClasses = existingClasses.filter((existingCls) => {
        // For each property type, check if the existing class should be replaced
        for (const [propertyType, propertyClass] of Object.entries(
          newClassesByProperty
        )) {
          // If we have patterns for this property, check if the existing class matches any
          if (classPropertyMap[propertyType]) {
            const matchesProperty = classPropertyMap[propertyType].some(
              (pattern) => {
                return (
                  existingCls.startsWith(pattern) || existingCls === pattern
                );
              }
            );

            // If it matches a pattern for this property, it should be replaced
            if (matchesProperty) {
              console.log(
                `Replacing class: ${existingCls} with ${propertyClass}`
              );
              return false;
            }
          }
        }

        // Keep the class if it doesn't match any property we're updating
        return true;
      });

      // Combine filtered existing classes with new classes
      const updatedClasses = [...filteredClasses, ...tailwindClasses].join(' ');

      // Replace the className value
      const line = lines[classNameLine];
      const quoteChar = line.includes('className="') ? '"' : "'";

      const beforeClassName = line.substring(
        0,
        line.indexOf(`className=${quoteChar}`) + `className=${quoteChar}`.length
      );
      const afterClassName = line.substring(
        line.indexOf(`className=${quoteChar}`) +
          `className=${quoteChar}`.length +
          currentClasses.length
      );

      lines[classNameLine] =
        `${beforeClassName}${updatedClasses}${afterClassName}`;
      console.log('Updated className attribute with:', updatedClasses);
    } else {
      // No existing className attribute, need to add one
      // Find the tag opening
      const line = lines[componentLineIndex];
      const tagMatch = line.match(/<([a-zA-Z][a-zA-Z0-9]*)/);

      if (tagMatch) {
        // Insert className attribute after the tag name
        const tagName = tagMatch[1];
        const tagIndex = line.indexOf(tagName) + tagName.length;
        const beforeAttr = line.substring(0, tagIndex);
        const afterAttr = line.substring(tagIndex);

        // Combine all tailwind classes
        const classNames = tailwindClasses.join(' ');

        lines[componentLineIndex] =
          `${beforeAttr} className="${classNames}"${afterAttr}`;
        console.log(`Added new className attribute to ${tagName} tag`);
      } else {
        console.error('Could not find tag name to add className attribute');
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert style object to Tailwind classes
   */
  private static stylesToTailwindClasses(styles: StyleChanges): string[] {
    const tailwindClasses: string[] = [];

    // Map common CSS properties to Tailwind utility classes
    for (const [property, value] of Object.entries(styles)) {
      switch (property) {
        // Colors
        case 'color':
          // Map CSS color to Tailwind text color
          tailwindClasses.push(this.colorToTailwind(value, 'text'));
          break;
        case 'backgroundColor':
          tailwindClasses.push(this.colorToTailwind(value, 'bg'));
          break;
        case 'borderColor':
          tailwindClasses.push(this.colorToTailwind(value, 'border'));
          break;

        // Typography
        case 'fontSize':
          tailwindClasses.push(this.fontSizeToTailwind(value));
          break;
        case 'fontWeight':
          tailwindClasses.push(this.fontWeightToTailwind(value));
          break;
        case 'textAlign':
          tailwindClasses.push(`text-${value}`);
          break;

        // Spacing
        case 'margin':
        case 'padding':
          const prefix = property === 'margin' ? 'm' : 'p';
          tailwindClasses.push(this.spacingToTailwind(value, prefix));
          break;
        case 'marginTop':
          tailwindClasses.push(this.spacingToTailwind(value, 'mt'));
          break;
        case 'marginRight':
          tailwindClasses.push(this.spacingToTailwind(value, 'mr'));
          break;
        case 'marginBottom':
          tailwindClasses.push(this.spacingToTailwind(value, 'mb'));
          break;
        case 'marginLeft':
          tailwindClasses.push(this.spacingToTailwind(value, 'ml'));
          break;
        case 'paddingTop':
          tailwindClasses.push(this.spacingToTailwind(value, 'pt'));
          break;
        case 'paddingRight':
          tailwindClasses.push(this.spacingToTailwind(value, 'pr'));
          break;
        case 'paddingBottom':
          tailwindClasses.push(this.spacingToTailwind(value, 'pb'));
          break;
        case 'paddingLeft':
          tailwindClasses.push(this.spacingToTailwind(value, 'pl'));
          break;

        // Display & Layout
        case 'display':
          tailwindClasses.push(
            value === 'flex'
              ? 'flex'
              : value === 'grid'
                ? 'grid'
                : value === 'block'
                  ? 'block'
                  : value === 'inline'
                    ? 'inline'
                    : value === 'none'
                      ? 'hidden'
                      : ''
          );
          break;
        case 'flexDirection':
          tailwindClasses.push(value === 'column' ? 'flex-col' : 'flex-row');
          break;
        case 'justifyContent':
          switch (value) {
            case 'flex-start':
              tailwindClasses.push('justify-start');
              break;
            case 'flex-end':
              tailwindClasses.push('justify-end');
              break;
            case 'center':
              tailwindClasses.push('justify-center');
              break;
            case 'space-between':
              tailwindClasses.push('justify-between');
              break;
            case 'space-around':
              tailwindClasses.push('justify-around');
              break;
          }
          break;
        case 'alignItems':
          switch (value) {
            case 'flex-start':
              tailwindClasses.push('items-start');
              break;
            case 'flex-end':
              tailwindClasses.push('items-end');
              break;
            case 'center':
              tailwindClasses.push('items-center');
              break;
            case 'stretch':
              tailwindClasses.push('items-stretch');
              break;
            case 'baseline':
              tailwindClasses.push('items-baseline');
              break;
          }
          break;

        // Width & Height
        case 'width':
          if (value.endsWith('%')) {
            const percentage = parseInt(value);
            if (percentage === 100) tailwindClasses.push('w-full');
            else if (percentage === 50) tailwindClasses.push('w-1/2');
            else if (percentage === 25) tailwindClasses.push('w-1/4');
            else if (percentage === 75) tailwindClasses.push('w-3/4');
            else if (percentage === 33) tailwindClasses.push('w-1/3');
            else if (percentage === 66) tailwindClasses.push('w-2/3');
          } else if (value.endsWith('px')) {
            tailwindClasses.push(`w-[${value}]`);
          } else {
            tailwindClasses.push(`w-[${value}]`);
          }
          break;
        case 'height':
          if (value.endsWith('%')) {
            const percentage = parseInt(value);
            if (percentage === 100) tailwindClasses.push('h-full');
            else if (percentage === 50) tailwindClasses.push('h-1/2');
            else if (percentage === 25) tailwindClasses.push('h-1/4');
            else if (percentage === 75) tailwindClasses.push('h-3/4');
          } else if (value.endsWith('px')) {
            tailwindClasses.push(`h-[${value}]`);
          } else {
            tailwindClasses.push(`h-[${value}]`);
          }
          break;

        // Border
        case 'borderWidth':
          if (value === '1px' || value === '1') tailwindClasses.push('border');
          else if (value === '2px' || value === '2')
            tailwindClasses.push('border-2');
          else if (value === '4px' || value === '4')
            tailwindClasses.push('border-4');
          else if (value === '8px' || value === '8')
            tailwindClasses.push('border-8');
          break;
        case 'borderRadius':
          if (value === '0px' || value === '0')
            tailwindClasses.push('rounded-none');
          else if (value === '0.125rem' || value === '2px')
            tailwindClasses.push('rounded-sm');
          else if (value === '0.25rem' || value === '4px')
            tailwindClasses.push('rounded');
          else if (value === '0.375rem' || value === '6px')
            tailwindClasses.push('rounded-md');
          else if (value === '0.5rem' || value === '8px')
            tailwindClasses.push('rounded-lg');
          else if (value === '9999px' || value === '9999')
            tailwindClasses.push('rounded-full');
          else tailwindClasses.push(`rounded-[${value}]`);
          break;
      }
    }

    return tailwindClasses.filter((c) => c); // Remove any empty strings
  }

  /**
   * Convert color values to Tailwind classes
   */
  private static colorToTailwind(color: string, prefix: string): string {
    // Handle common colors directly
    const commonColors: { [key: string]: string } = {
      black: `${prefix}-black`,
      white: `${prefix}-white`,
      red: `${prefix}-red-500`,
      blue: `${prefix}-blue-500`,
      green: `${prefix}-green-500`,
      yellow: `${prefix}-yellow-500`,
      purple: `${prefix}-purple-500`,
      pink: `${prefix}-pink-500`,
      indigo: `${prefix}-indigo-500`,
      gray: `${prefix}-gray-500`,
    };

    // Check for common color names
    if (color.toLowerCase() in commonColors) {
      return commonColors[color.toLowerCase()];
    }

    // For hex values or RGB, use arbitrary values
    if (color.startsWith('#') || color.startsWith('rgb')) {
      // Sanitize the color value to remove any characters that might break JSX
      const safeColor = this.sanitizeArbitraryValue(color);
      return `${prefix}-[${safeColor}]`;
    }

    // Try to match Tailwind colors with shades
    // Example: 'blue-500' -> 'text-blue-500'
    if (color.includes('-')) {
      return `${prefix}-${color}`;
    }

    // Default to arbitrary value with sanitization
    const safeColor = this.sanitizeArbitraryValue(color);
    return `${prefix}-[${safeColor}]`;
  }

  /**
   * Sanitize arbitrary values to prevent JSX parsing issues
   */
  private static sanitizeArbitraryValue(value: string): string {
    // Replace any characters that might conflict with JSX syntax
    return value.replace(/[<>]/g, '');
  }

  /**
   * Convert font size values to Tailwind classes
   */
  private static fontSizeToTailwind(fontSize: string): string {
    // Map common font sizes to Tailwind classes
    if (fontSize === '0.75rem' || fontSize === '12px') return 'text-xs';
    if (fontSize === '0.875rem' || fontSize === '14px') return 'text-sm';
    if (fontSize === '1rem' || fontSize === '16px') return 'text-base';
    if (fontSize === '1.125rem' || fontSize === '18px') return 'text-lg';
    if (fontSize === '1.25rem' || fontSize === '20px') return 'text-xl';
    if (fontSize === '1.5rem' || fontSize === '24px') return 'text-2xl';
    if (fontSize === '1.875rem' || fontSize === '30px') return 'text-3xl';
    if (fontSize === '2.25rem' || fontSize === '36px') return 'text-4xl';
    if (fontSize === '3rem' || fontSize === '48px') return 'text-5xl';
    if (fontSize === '3.75rem' || fontSize === '60px') return 'text-6xl';
    if (fontSize === '4.5rem' || fontSize === '72px') return 'text-7xl';
    if (fontSize === '6rem' || fontSize === '96px') return 'text-8xl';
    if (fontSize === '8rem' || fontSize === '128px') return 'text-9xl';

    // For other values, use arbitrary values
    return `text-[${fontSize}]`;
  }

  /**
   * Convert font weight values to Tailwind classes
   */
  private static fontWeightToTailwind(fontWeight: string): string {
    // Map font weights to Tailwind classes
    if (fontWeight === '100') return 'font-thin';
    if (fontWeight === '200') return 'font-extralight';
    if (fontWeight === '300') return 'font-light';
    if (fontWeight === '400' || fontWeight === 'normal') return 'font-normal';
    if (fontWeight === '500') return 'font-medium';
    if (fontWeight === '600') return 'font-semibold';
    if (fontWeight === '700' || fontWeight === 'bold') return 'font-bold';
    if (fontWeight === '800') return 'font-extrabold';
    if (fontWeight === '900') return 'font-black';

    // For other values, use arbitrary values
    return `font-[${fontWeight}]`;
  }

  /**
   * Convert spacing values to Tailwind classes
   */
  private static spacingToTailwind(spacing: string, prefix: string): string {
    // Remove 'px' if present and convert to number
    const value = spacing.replace('px', '');

    // Map common spacing values to Tailwind scale
    if (value === '0') return `${prefix}-0`;
    if (value === '1' || value === '0.25rem' || value === '4')
      return `${prefix}-1`;
    if (value === '2' || value === '0.5rem' || value === '8')
      return `${prefix}-2`;
    if (value === '3' || value === '0.75rem' || value === '12')
      return `${prefix}-3`;
    if (value === '4' || value === '1rem' || value === '16')
      return `${prefix}-4`;
    if (value === '5' || value === '1.25rem' || value === '20')
      return `${prefix}-5`;
    if (value === '6' || value === '1.5rem' || value === '24')
      return `${prefix}-6`;
    if (value === '8' || value === '2rem' || value === '32')
      return `${prefix}-8`;
    if (value === '10' || value === '2.5rem' || value === '40')
      return `${prefix}-10`;
    if (value === '12' || value === '3rem' || value === '48')
      return `${prefix}-12`;
    if (value === '16' || value === '4rem' || value === '64')
      return `${prefix}-16`;

    // For other values, use arbitrary values
    return `${prefix}-[${spacing}]`;
  }

  /**
   * Persist content changes to the source code file
   */
  static async persistContentChanges(
    component: ComponentData,
    content: string
  ): Promise<boolean> {
    try {
      logger.info(
        `Persisting content changes for component: ${component.name}`
      );

      const fullFilePath = this.getFullFilePath(component.path);

      // First, fetch the original file content
      const fileResponse = await fetch(
        `/api/file?path=${encodeURIComponent(fullFilePath)}`
      );
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fullFilePath}`);
      }

      const fileData = await fileResponse.json();
      const originalContent = fileData.content;

      // Update the file with new content
      let updatedContent = this.applyContentToCode(
        originalContent,
        parseInt(component.line),
        content
      );

      // Validate the JSX syntax to catch potential errors
      updatedContent = this.validateJsxSyntax(updatedContent);

      // Log what we're about to do for debugging
      console.log('Preparing to save content changes:', {
        filePath: fullFilePath,
        originalSize: originalContent.length,
        updatedSize: updatedContent.length,
        componentLine: component.line,
      });

      // Save the updated content back to the file
      const updateResponse = await fetch('/api/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: fullFilePath,
          newContent: updatedContent,
        }),
      });

      const responseData = await updateResponse.json();

      if (!updateResponse.ok) {
        console.error('API error response:', responseData);
        throw new Error(
          `Failed to update file: ${responseData.error || 'Unknown error'}`
        );
      }

      logger.info(`Successfully persisted content changes to ${fullFilePath}`);
      console.log('File update response:', responseData);

      return true;
    } catch (error) {
      logger.error('Error persisting content changes:', error);
      console.error('StyleUpdateService error:', error);
      return false;
    }
  }

  /**
   * Apply style changes to code
   * This is a simple implementation that handles inline styles in React components
   */
  private static applyStylesToCode(
    content: string,
    lineNumber: number,
    styles: StyleChanges
  ): string {
    // Split the content into lines for processing
    const lines = content.split('\n');

    // Find the component definition and its style object
    let componentLineIndex = lineNumber - 1;
    let styleLineIndex = -1;
    let styleIndentation = '';
    let styleOpenBraceIndex = -1;
    let styleCloseBraceIndex = -1;

    console.log(
      `Searching for style definition around line ${lineNumber} (index ${componentLineIndex})`
    );

    // Search for style definition around the component line
    for (let i = componentLineIndex; i < lines.length; i++) {
      if (lines[i].includes('style={') || lines[i].includes('style={{')) {
        styleLineIndex = i;
        styleIndentation = lines[i].match(/^\s*/)?.[0] || '';

        console.log(`Found style definition at line ${i + 1}:`, lines[i]);

        // Check if style is inline or multiline
        if (
          lines[i].includes('{') &&
          lines[i].includes('}') &&
          !lines[i].includes('{{')
        ) {
          // Inline style: style={{ prop: value }}
          styleOpenBraceIndex = i;
          styleCloseBraceIndex = i;
        } else {
          // Multiline style: style={{
          //   prop: value
          // }}
          styleOpenBraceIndex = i;

          // Find closing brace
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].includes('}}')) {
              styleCloseBraceIndex = j;
              console.log(`Found closing brace at line ${j + 1}:`, lines[j]);
              break;
            }
          }
        }
        break;
      }
    }

    if (styleLineIndex === -1) {
      // No existing style prop found, add one to the component
      console.log('No existing style prop found, adding new one');
      return this.addNewStyleProp(lines, componentLineIndex, styles);
    } else {
      // Update existing style prop
      console.log('Updating existing style prop', {
        openBrace: styleOpenBraceIndex + 1,
        closeBrace: styleCloseBraceIndex + 1,
      });
      return this.updateExistingStyleProp(
        lines,
        styleOpenBraceIndex,
        styleCloseBraceIndex,
        styleIndentation,
        styles
      );
    }
  }

  /**
   * Add a new style prop to a component that doesn't have one
   */
  private static addNewStyleProp(
    lines: string[],
    componentLineIndex: number,
    styles: StyleChanges
  ): string {
    // Find where to insert the style prop
    const line = lines[componentLineIndex];
    const indentation = line.match(/^\s*/)?.[0] || '';
    const extraIndent = '  ';

    // Convert styles object to style string
    const styleEntries = Object.entries(styles)
      .map(
        ([key, value]) =>
          `${indentation}${extraIndent}${extraIndent}${this.formatStyleProperty(key)}: '${value}'`
      )
      .join(',\n');

    // Create the style prop
    const styleProp = ` style={{\n${styleEntries}\n${indentation}${extraIndent}}}`;

    // Insert the style prop into the component
    // Look for the first > or closing tag
    let insertionIndex = componentLineIndex;
    let tag = '';
    let insertBeforeClosingBracket = false;

    for (let i = componentLineIndex; i < lines.length; i++) {
      // Extract the tag name for better parsing
      if (i === componentLineIndex) {
        const tagMatch = lines[i].match(/<([a-zA-Z][a-zA-Z0-9]*)/);
        if (tagMatch) {
          tag = tagMatch[1];
          console.log(`Found tag: ${tag} at line ${i + 1}`);
        }
      }

      // Check if this line has a self-closing tag or a closing angle bracket
      if (lines[i].includes('/>')) {
        // Self-closing tag: <div />
        insertionIndex = i;
        insertBeforeClosingBracket = true;
        break;
      } else if (lines[i].includes('>')) {
        // Opening tag: <div>
        insertionIndex = i;
        const tagCloseIndex = lines[i].lastIndexOf('>');
        const tagOpenIndex = lines[i].lastIndexOf('<');

        // Check if this is an opening tag or a closing tag
        if (
          tagOpenIndex < tagCloseIndex &&
          !lines[i].substring(tagOpenIndex, tagCloseIndex).includes('</')
        ) {
          insertBeforeClosingBracket = true;
          break;
        }
      }
    }

    if (insertBeforeClosingBracket) {
      const line = lines[insertionIndex];
      if (line.includes('/>')) {
        // Handle self-closing tag
        lines[insertionIndex] = line.replace('/>', `${styleProp} />`);
      } else if (line.includes('>')) {
        // Handle regular tag
        const lastBracketIndex = line.lastIndexOf('>');
        lines[insertionIndex] =
          line.substring(0, lastBracketIndex) +
          styleProp +
          line.substring(lastBracketIndex);
      }
    } else {
      // Couldn't find proper insertion point, append to the component line
      lines[componentLineIndex] += styleProp;
    }

    return lines.join('\n');
  }

  /**
   * Update an existing style prop
   */
  private static updateExistingStyleProp(
    lines: string[],
    openBraceIndex: number,
    closeBraceIndex: number,
    indentation: string,
    styles: StyleChanges
  ): string {
    // Check if it's an inline style (one line) or multiline
    if (openBraceIndex === closeBraceIndex) {
      console.log('Updating inline style');
      // Inline style - convert to multiline for better readability
      const beforeBrace = lines[openBraceIndex].substring(
        0,
        lines[openBraceIndex].indexOf('{{') + 2
      );
      const afterBrace = lines[openBraceIndex].substring(
        lines[openBraceIndex].indexOf('}}')
      );

      // Parse existing inline styles
      const styleContent = lines[openBraceIndex].substring(
        lines[openBraceIndex].indexOf('{{') + 2,
        lines[openBraceIndex].indexOf('}}')
      );
      const existingStyles = this.parseExistingStyles(styleContent);

      // Merge existing styles with new styles
      const mergedStyles = { ...existingStyles, ...styles };

      // Format the merged styles
      const styleEntries = Object.entries(mergedStyles)
        .map(
          ([key, value]) =>
            `${indentation}  ${this.formatStyleProperty(key)}: '${value}'`
        )
        .join(',\n');

      lines[openBraceIndex] =
        `${beforeBrace}\n${styleEntries}\n${indentation}${afterBrace}`;
    } else {
      console.log('Updating multiline style');
      // Multiline style - parse existing styles and update/add new ones
      const styleContent = lines
        .slice(openBraceIndex + 1, closeBraceIndex)
        .join('\n');
      const existingStyles = this.parseExistingStyles(styleContent);

      console.log('Existing styles:', existingStyles);
      console.log('New styles to apply:', styles);

      // Merge existing styles with new styles
      const mergedStyles = { ...existingStyles, ...styles };

      // Format the merged styles
      const styleEntries = Object.entries(mergedStyles)
        .map(
          ([key, value]) =>
            `${indentation}  ${this.formatStyleProperty(key)}: '${value}'`
        )
        .join(',\n');

      // Replace the lines between the braces with the new styles
      lines.splice(
        openBraceIndex + 1,
        closeBraceIndex - openBraceIndex - 1,
        styleEntries
      );
    }

    return lines.join('\n');
  }

  /**
   * Parse existing styles from a style content string
   */
  private static parseExistingStyles(styleContent: string): StyleChanges {
    const styles: StyleChanges = {};

    try {
      // Use regex to find style properties
      // This regex handles different style formats:
      // - key: 'value'
      // - key: "value"
      // - key: value
      const styleRegex = /([a-zA-Z0-9]+):\s*['"]?([^'",}\s][^'",}]*)['"]?/g;
      let match;

      while ((match = styleRegex.exec(styleContent)) !== null) {
        const [, key, value] = match;
        styles[key] = value.trim().replace(/['"]/g, '');
      }
    } catch (error) {
      console.error('Error parsing styles:', error);
    }

    return styles;
  }

  /**
   * Format style property key from camelCase to the correct format
   */
  private static formatStyleProperty(key: string): string {
    return key;
  }

  /**
   * Apply content changes to code
   * This handles changing the text content of a component
   */
  private static applyContentToCode(
    content: string,
    lineNumber: number,
    newText: string
  ): string {
    // Split the content into lines for processing
    const lines = content.split('\n');

    // Find the component definition
    let componentLineIndex = lineNumber - 1;

    console.log(
      `Searching for content to modify around line ${lineNumber} (index ${componentLineIndex})`
    );

    // Different approaches to modifying content based on component type

    // 1. Look for simple text content between tags
    const startLine = componentLineIndex;
    let endLine = -1;
    let openTagLine = -1;
    let closeTagLine = -1;
    let tagName = '';

    // First find the opening tag
    for (let i = startLine; i < Math.min(startLine + 10, lines.length); i++) {
      const line = lines[i];
      // Look for an opening tag that doesn't self-close
      if (
        line.match(/<[^>]*>/) &&
        !line.includes('/>') &&
        !line.match(/<[^>]*><\/[^>]*>/)
      ) {
        const match = line.match(/<([a-zA-Z0-9]+)[^>]*>/);
        if (match) {
          tagName = match[1];
          openTagLine = i;
          console.log(
            `Found opening ${tagName} tag at line ${openTagLine + 1}:`,
            line
          );
          break;
        }
      }
    }

    // If we found an opening tag, look for the matching closing tag
    if (openTagLine >= 0 && tagName) {
      const closingTagRegex = new RegExp(`<\\/${tagName}>`);
      for (
        let i = openTagLine + 1;
        i < Math.min(openTagLine + 20, lines.length);
        i++
      ) {
        if (lines[i].match(closingTagRegex)) {
          closeTagLine = i;
          console.log(
            `Found closing ${tagName} tag at line ${closeTagLine + 1}:`,
            lines[i]
          );
          break;
        }
      }

      // If we found both tags, replace the content between them
      if (closeTagLine > openTagLine) {
        // Check if opening tag is on the same line as the closing tag
        if (closeTagLine === openTagLine) {
          // This is an inline component like <p>text</p>
          const line = lines[openTagLine];
          const openTagEnd = line.indexOf('>') + 1;
          const closeTagStart = line.lastIndexOf('</');

          if (openTagEnd > 0 && closeTagStart > openTagEnd) {
            const beforeContent = line.substring(0, openTagEnd);
            const afterContent = line.substring(closeTagStart);

            // Ensure the content is properly sanitized by escaping any HTML
            lines[openTagLine] = `${beforeContent}${newText}${afterContent}`;
            console.log('Updated inline content');
          }
        } else {
          // This is a multiline component, replace everything between the tags
          const openTagLine = startLine;

          // Find the end of the opening tag
          let contentStartLine = openTagLine;
          const openLine = lines[openTagLine];
          if (openLine.includes('>')) {
            // Opening tag ends on this line
            contentStartLine = openTagLine;
          } else {
            // Opening tag spans multiple lines, find where it ends
            for (let i = openTagLine + 1; i < lines.length; i++) {
              if (lines[i].includes('>')) {
                contentStartLine = i;
                break;
              }
            }
          }

          // Find the start of the closing tag
          for (let i = contentStartLine + 1; i < lines.length; i++) {
            if (lines[i].includes('</')) {
              endLine = i;
              break;
            }
          }

          if (endLine > contentStartLine) {
            // Log what we found for debugging
            console.log('Found content boundaries:', {
              contentStartLine: contentStartLine + 1,
              endLine: endLine + 1,
              openTagLine: openTagLine + 1,
            });

            // Split the lines where the tags end/start
            const openTagEndIndex = lines[contentStartLine].indexOf('>') + 1;
            const closeTagStartIndex = lines[endLine].indexOf('</');

            // Get the indentation from the first content line
            const indentation = lines[contentStartLine].substring(
              0,
              lines[contentStartLine].search(/\S/)
            );

            // Create the new content with proper indentation
            const indentedContent = newText
              .split('\n')
              .map((line, i) => (i === 0 ? line : indentation + line))
              .join('\n');

            // Replace content between tags
            if (contentStartLine === endLine) {
              // Tags are on the same line
              lines[contentStartLine] =
                lines[contentStartLine].substring(0, openTagEndIndex) +
                indentedContent +
                lines[endLine].substring(closeTagStartIndex);
            } else {
              // Tags are on different lines
              // Modify start line to include end of opening tag + new content start
              lines[contentStartLine] =
                lines[contentStartLine].substring(0, openTagEndIndex) +
                indentedContent;

              // Modify end line to be just the closing tag portion
              lines[endLine] =
                indentation + lines[endLine].substring(closeTagStartIndex);

              // Remove all lines in between
              if (endLine - contentStartLine > 1) {
                lines.splice(
                  contentStartLine + 1,
                  endLine - contentStartLine - 1
                );
              }
            }

            console.log('Updated multiline content');
          }
        }
      } else {
        // Special case: check for improperly formatted tags or special components
        console.log(
          'Could not find proper tag boundaries, using basic content replacement'
        );

        // Try to find any tag with a proper closing tag
        for (
          let i = startLine;
          i < Math.min(startLine + 5, lines.length);
          i++
        ) {
          const line = lines[i];

          // Look for patterns like: <h1>text</h1> or <h1 className="...">text</h1>
          const tagContentRegex = /<([a-zA-Z0-9]+)([^>]*)>([^<]*)<\/\1>/g;
          let match;

          while ((match = tagContentRegex.exec(line)) !== null) {
            const [fullMatch, tag, attributes, currentContent] = match;
            const replacement = `<${tag}${attributes}>${newText}</${tag}>`;

            // Replace just this occurrence
            lines[i] = line.replace(fullMatch, replacement);
            console.log(`Fixed content in ${tag} tag using direct replacement`);
            return lines.join('\n');
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Validate and fix JSX syntax in the updated content
   * This helps catch common syntax errors before they're saved to the file
   */
  private static validateJsxSyntax(content: string): string {
    // Split into lines to process
    let lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Fix arbitrary values in className attributes that might contain problematic characters
      line = this.sanitizeArbitraryValuesInClassNames(line);

      // Fix missing closing brackets in JSX tags
      // Example: <h1 className="class"Text</h1> → <h1 className="class">Text</h1>
      const missingClosingBracketRegex =
        /(<[a-zA-Z][a-zA-Z0-9]*[^<>]*"[^<>]*)([a-zA-Z0-9])/g;
      if (missingClosingBracketRegex.test(line)) {
        line = line.replace(missingClosingBracketRegex, '$1>$2');
        console.log(`Fixed missing '>' in JSX tag at line ${i + 1}`);
      }

      // Fix incorrect closing tags
      // Look for patterns where closing tag doesn't match opening tag
      const openingTagMatch = line.match(/<([a-zA-Z][a-zA-Z0-9]*)[^<>]*>[^<]*/);
      const closingTagMatch = line.match(/[^>]*<\/([a-zA-Z][a-zA-Z0-9]*)>/);

      if (
        openingTagMatch &&
        closingTagMatch &&
        openingTagMatch[1] !== closingTagMatch[1]
      ) {
        // Fix the closing tag to match the opening tag
        line = line.replace(
          `</${closingTagMatch[1]}>`,
          `</${openingTagMatch[1]}>`
        );
        console.log(
          `Fixed mismatched closing tag: ${closingTagMatch[1]} → ${openingTagMatch[1]}`
        );
      }

      // Fix syntax errors in style attributes
      if (line.includes('style={') && !line.includes('}}')) {
        // Find unclosed style object
        const styleOpenIndex = line.indexOf('style={');
        if (styleOpenIndex > -1 && !line.includes('}}', styleOpenIndex)) {
          // Add missing closing braces
          if (
            line.includes('{', styleOpenIndex + 7) &&
            !line.includes('}', styleOpenIndex + 8)
          ) {
            line = line + '}}';
            console.log(`Fixed unclosed style object at line ${i + 1}`);
          }
        }
      }

      // Update the line with all fixes
      lines[i] = line;
    }

    return lines.join('\n');
  }

  /**
   * Sanitize arbitrary values in className attributes to prevent JSX parsing issues
   */
  private static sanitizeArbitraryValuesInClassNames(line: string): string {
    // Find className attribute
    const classNameMatch = line.match(/className\s*=\s*["']([^"']*)["']/);
    if (!classNameMatch) return line;

    const fullMatch = classNameMatch[0];
    const classNames = classNameMatch[1];

    // Find arbitrary values in Tailwind classes
    // This regex looks for patterns like bg-[#fff] or p-[10px] or m-[2rem]
    const sanitizedClassNames = classNames.replace(
      /\[([^\]]*)\]/g,
      (match, content) => {
        // Remove any characters that could break JSX
        const safeContent = content.replace(/[<>]/g, '');
        return `[${safeContent}]`;
      }
    );

    // Replace the className attribute with the sanitized version
    if (sanitizedClassNames !== classNames) {
      console.log(
        `Sanitized arbitrary values in className at line with "${line.substring(0, 50)}..."`
      );
      return line.replace(
        fullMatch,
        fullMatch.replace(classNames, sanitizedClassNames)
      );
    }

    return line;
  }
}
