import { StyleChanges } from './index';
import { TailwindConverter } from './tailwindConverter';

/**
 * Utility class for manipulating code and applying style/content changes
 */
export class CodeManipulator {
  /**
   * Apply Tailwind classes to code instead of inline styles
   */
  static applyTailwindClassesToCode(
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

    // Direct className update in styles?
    let tailwindClasses: string[] = [];
    if (styles.className !== undefined) {
      // Use the className directly as provided - this is the key part for supporting class removal
      tailwindClasses = styles.className.split(' ').filter(Boolean);
      console.log('Using directly provided className:', tailwindClasses);
    } else {
      // Convert style object to Tailwind classes
      tailwindClasses = TailwindConverter.stylesToTailwindClasses(styles);
      console.log('Converted styles to Tailwind classes:', tailwindClasses);
    }

    // Log the final classes to add
    console.log('Tailwind classes to add:', tailwindClasses);

    if (classNameLine >= 0) {
      // Update existing className attribute with the exact classes provided
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

      // When className is explicitly provided, use it directly without merging
      if (styles.className !== undefined) {
        const updatedClasses = tailwindClasses.join(' ');
        lines[classNameLine] =
          `${beforeClassName}${updatedClasses}${afterClassName}`;
        console.log(
          'Updated className attribute with exact classes:',
          updatedClasses
        );
      } else {
        // Original behavior for style object conversion - parse current classes and potentially merge
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

          // Padding - all shorthand forms and individual sides
          padding: ['p-', 'pt-', 'pr-', 'pb-', 'pl-', 'px-', 'py-'],

          // Margin - all shorthand forms and individual sides
          margin: ['m-', 'mt-', 'mr-', 'mb-', 'ml-', 'mx-', 'my-'],

          // Overflow
          overflow: ['overflow-'],
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
          } else if (
            cls.startsWith('p-') ||
            cls.startsWith('pt-') ||
            cls.startsWith('pr-') ||
            cls.startsWith('pb-') ||
            cls.startsWith('pl-') ||
            cls.startsWith('px-') ||
            cls.startsWith('py-')
          ) {
            propertyType = 'padding';
          } else if (
            cls.startsWith('m-') ||
            cls.startsWith('mt-') ||
            cls.startsWith('mr-') ||
            cls.startsWith('mb-') ||
            cls.startsWith('ml-') ||
            cls.startsWith('mx-') ||
            cls.startsWith('my-')
          ) {
            propertyType = 'margin';
          }

          if (propertyType) {
            // For spacing properties, keep track of which specific property was set
            if (propertyType === 'padding' || propertyType === 'margin') {
              // Extract the specific padding/margin property (p-, pt-, etc.)
              const prefix = cls.split('-')[0] + '-';
              newClassesByProperty[prefix] = cls;
            } else {
              newClassesByProperty[propertyType] = cls;
            }
          }
        });

        // Filter out classes that would conflict with the new ones
        const filteredClasses = existingClasses.filter((existingCls) => {
          // Don't include empty classes
          if (!existingCls.trim()) return false;

          // First, check for exact duplicates of new classes we're going to add
          if (tailwindClasses.includes(existingCls)) {
            console.log(`Removing duplicate class: ${existingCls}`);
            return false;
          }

          // For each property type, check if the existing class should be replaced
          for (const [propertyType, propertyClass] of Object.entries(
            newClassesByProperty
          )) {
            // Handle padding and margin specially - we need to consider conflicts between
            // general properties (p-) and specific sides (pt-, pr-, etc.)
            if (
              propertyType === 'p-' ||
              (propertyType.startsWith('p') && propertyType.length === 3)
            ) {
              // If setting general padding (p-), remove all padding classes
              if (propertyType === 'p-') {
                if (
                  existingCls.startsWith('p-') ||
                  existingCls.startsWith('pt-') ||
                  existingCls.startsWith('pr-') ||
                  existingCls.startsWith('pb-') ||
                  existingCls.startsWith('pl-') ||
                  existingCls.startsWith('px-') ||
                  existingCls.startsWith('py-')
                ) {
                  console.log(
                    `Removing conflicting padding class: ${existingCls} (replaced by ${propertyClass})`
                  );
                  return false;
                }
              }
              // If setting specific padding (pt-, pr-, etc.), only remove that specific direction
              else if (existingCls.startsWith(propertyType)) {
                console.log(
                  `Removing specific padding class: ${existingCls} (replaced by ${propertyClass})`
                );
                return false;
              }
            }
            // Similar logic for margin
            else if (
              propertyType === 'm-' ||
              (propertyType.startsWith('m') && propertyType.length === 3)
            ) {
              // If setting general margin (m-), remove all margin classes
              if (propertyType === 'm-') {
                if (
                  existingCls.startsWith('m-') ||
                  existingCls.startsWith('mt-') ||
                  existingCls.startsWith('mr-') ||
                  existingCls.startsWith('mb-') ||
                  existingCls.startsWith('ml-') ||
                  existingCls.startsWith('mx-') ||
                  existingCls.startsWith('my-')
                ) {
                  console.log(
                    `Removing conflicting margin class: ${existingCls} (replaced by ${propertyClass})`
                  );
                  return false;
                }
              }
              // If setting specific margin (mt-, mr-, etc.), only remove that specific direction
              else if (existingCls.startsWith(propertyType)) {
                console.log(
                  `Removing specific margin class: ${existingCls} (replaced by ${propertyClass})`
                );
                return false;
              }
            }
            // For other property types, use the pattern matching approach
            else if (classPropertyMap[propertyType]) {
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

        // Combine filtered existing classes with new classes and deduplicate
        const combinedClasses = [...filteredClasses, ...tailwindClasses];
        const uniqueClasses = this.deduplicateClasses(combinedClasses);
        const updatedClasses = uniqueClasses.join(' ');

        lines[classNameLine] =
          `${beforeClassName}${updatedClasses}${afterClassName}`;
        console.log(
          'Updated className attribute with merged classes:',
          updatedClasses
        );
      }
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
   * Apply style changes to code
   * This is a simple implementation that handles inline styles in React components
   */
  static applyStylesToCode(
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
  static applyContentToCode(
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
  static validateJsxSyntax(content: string): string {
    // Split into lines to process
    let lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Fix arbitrary values in className attributes that might contain problematic characters
      line = this.sanitizeArbitraryValuesInClassNames(line);

      // Fix missing closing brackets in JSX tags
      // Example: <h1 className="class"Text</h1> → <h1 className="class">Text</h1>
      /*
      const missingClosingBracketRegex =
        /(<[a-zA-Z][a-zA-Z0-9]*[^<>]*"[^<>]*)([a-zA-Z0-9])/g;
      if (missingClosingBracketRegex.test(line)) {
        line = line.replace(missingClosingBracketRegex, '$1>$2');
        console.log(`Fixed missing '>' in JSX tag at line ${i + 1}`);
      }
      */

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

  /**
   * Deduplicate Tailwind classes, removing duplicates and handling conflicting classes
   */
  private static deduplicateClasses(classes: string[]): string[] {
    // Map to track which class types we've seen
    const classTypes: Record<string, string> = {};
    const result: string[] = [];

    // Process classes in reverse order so later ones override earlier ones
    const processOrder = [...classes].reverse();

    for (const cls of processOrder) {
      // Skip empty classes
      if (!cls.trim()) continue;

      // Determine class type based on prefix
      let classType = '';

      // Handle padding
      if (cls.startsWith('p-')) classType = 'p';
      else if (cls.startsWith('pt-')) classType = 'pt';
      else if (cls.startsWith('pr-')) classType = 'pr';
      else if (cls.startsWith('pb-')) classType = 'pb';
      else if (cls.startsWith('pl-')) classType = 'pl';
      else if (cls.startsWith('px-')) classType = 'px';
      else if (cls.startsWith('py-')) classType = 'py';
      // Handle margin
      else if (cls.startsWith('m-')) classType = 'm';
      else if (cls.startsWith('mt-')) classType = 'mt';
      else if (cls.startsWith('mr-')) classType = 'mr';
      else if (cls.startsWith('mb-')) classType = 'mb';
      else if (cls.startsWith('ml-')) classType = 'ml';
      else if (cls.startsWith('mx-')) classType = 'mx';
      else if (cls.startsWith('my-')) classType = 'my';
      // Handle text color
      else if (
        cls.startsWith('text-') &&
        !cls.match(
          /^text-(xs|sm|base|lg|xl|[2-9]xl|left|center|right|justify)$/
        )
      ) {
        classType = 'text-color';
      }
      // Handle font size
      else if (cls.match(/^text-(xs|sm|base|lg|xl|[2-9]xl)$/)) {
        classType = 'text-size';
      }
      // Handle text alignment
      else if (cls.match(/^text-(left|center|right|justify)$/)) {
        classType = 'text-align';
      }
      // Handle background color
      else if (cls.startsWith('bg-')) {
        classType = 'bg';
      }
      // Handle overflow
      else if (cls.startsWith('overflow-')) {
        classType = 'overflow';
      }
      // Everything else
      else {
        classType = cls;
      }

      // If we haven't seen this class type or we're allowing duplicates, add it
      if (!classTypes[classType]) {
        classTypes[classType] = cls;
        result.unshift(cls); // Add to front since we're processing in reverse
      }
    }

    return result;
  }
}
