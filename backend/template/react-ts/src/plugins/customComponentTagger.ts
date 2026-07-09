// src/plugins/customComponentTagger.ts
import { parse, ParserOptions } from '@babel/parser';
import MagicString from 'magic-string';
import path from 'path';
import type { Node as BabelNode } from '@babel/types';

// Define a simple Plugin type if Vite types are not available
interface Plugin {
  name: string;
  enforce?: 'pre' | 'post';
  transform?: (code: string, id: string) => Promise<any> | any;
  closeBundle?: () => void;
  [key: string]: any;
}

// Define interface for our content object
interface ContentObject {
  text?: string;
  placeholder?: string;
  className?: string;
  [key: string]: string | undefined;
}

// Define interface for attributes
interface AttributesMap {
  [key: string]: string;
  placeholder?: string;
  className?: string;
}

const validExtensions = new Set(['.jsx', '.tsx']);

export function customComponentTagger(): Plugin {
  const cwd = process.cwd();
  const stats = {
    totalFiles: 0,
    processedFiles: 0,
    totalElements: 0,
  };

  return {
    name: 'vite-plugin-custom-component-tagger',
    enforce: 'pre',

    async transform(code, id) {
      // Only process JSX/TSX files, skip node_modules
      if (
        !validExtensions.has(path.extname(id)) ||
        id.includes('node_modules')
      ) {
        return null;
      }

      stats.totalFiles++;
      const relativePath = path.relative(cwd, id);

      try {
        // Parse the code into an AST
        const parserOptions: ParserOptions = {
          sourceType: 'module',
          plugins: ['jsx', 'typescript'] as any,
        };

        const ast = parse(code, parserOptions);
        const magicString = new MagicString(code);
        let changedElementsCount = 0;
        let currentElement: any = null;

        // Process the AST manually instead of using estree-walker
        const processAST = (node: BabelNode) => {
          if (node.type === 'Program') {
            // Process all program body elements
            for (const child of (node as any).body) {
              processAST(child);
            }
          }

          // Process JSX elements recursively
          if (node.type === 'JSXElement') {
            currentElement = node;

            // Process JSX opening element
            const jsxOpeningElement = (node as any).openingElement;
            if (jsxOpeningElement) {
              processJSXOpeningElement(jsxOpeningElement);
            }

            // Process children recursively
            if ((node as any).children) {
              for (const child of (node as any).children) {
                processAST(child);
              }
            }
          }

          // Recursively process other nodes
          for (const key in node) {
            if (node[key] && typeof node[key] === 'object' && key !== 'loc') {
              if (Array.isArray(node[key])) {
                for (const child of node[key]) {
                  if (child && typeof child === 'object') {
                    processAST(child as BabelNode);
                  }
                }
              } else if (node[key].type) {
                processAST(node[key] as BabelNode);
              }
            }
          }
        };

        const seenNodes = new Set<number>();
        // Process JSXOpeningElement nodes
        const processJSXOpeningElement = (jsxNode: any) => {
          if (seenNodes.has(jsxNode.start)) return;
          seenNodes.add(jsxNode.start);
          // Get the element name
          let elementName;
          if (jsxNode.name.type === 'JSXIdentifier') {
            elementName = jsxNode.name.name;
          } else if (jsxNode.name.type === 'JSXMemberExpression') {
            const memberExpr = jsxNode.name;
            elementName = `${memberExpr.object.name}.${memberExpr.property.name}`;
          } else {
            return;
          }

          // Skip React fragments
          if (elementName === 'Fragment' || elementName === 'React.Fragment') {
            return;
          }

          // Extract attributes
          const attributes: AttributesMap = jsxNode.attributes.reduce(
            (acc: AttributesMap, attr: any) => {
              if (attr.type === 'JSXAttribute') {
                if (attr.value?.type === 'StringLiteral') {
                  acc[attr.name.name] = attr.value.value;
                } else if (
                  attr.value?.type === 'JSXExpressionContainer' &&
                  attr.value.expression.type === 'StringLiteral'
                ) {
                  acc[attr.name.name] = attr.value.expression.value;
                }
              }
              return acc;
            },
            {},
          );

          // Extract text content
          let textContent = '';
          if (currentElement && (currentElement as any).children) {
            textContent = (currentElement as any).children
              .map((child: any) => {
                if (child.type === 'JSXText') {
                  return child.value.trim();
                } else if (child.type === 'JSXExpressionContainer') {
                  if (child.expression.type === 'StringLiteral') {
                    return child.expression.value;
                  }
                }
                return '';
              })
              .filter(Boolean)
              .join(' ')
              .trim();
          }

          // Build content object
          const content: ContentObject = {};
          if (textContent) {
            content.text = textContent;
          }
          if (attributes.placeholder) {
            content.placeholder = attributes.placeholder;
          }
          if (attributes.className) {
            content.className = attributes.className;
          }

          // Create component ID
          const line = jsxNode.loc?.start?.line ?? 0;
          const col = jsxNode.loc?.start?.column ?? 0;
          const dataComponentId = `${relativePath}:${line}:${col}`;
          const fileName = path.basename(id);

          // Add data attributes
          const dataAttrs = ` data-custom-id="${dataComponentId}" data-custom-name="${elementName}" data-custom-path="${relativePath}" data-custom-line="${line}" data-custom-file="${fileName}" data-custom-content="${encodeURIComponent(
            JSON.stringify(content),
          )}"`;

          magicString.appendLeft(jsxNode.name.end ?? 0, dataAttrs);
          changedElementsCount++;
        };

        // Process the AST
        processAST(ast.program);

        stats.processedFiles++;
        stats.totalElements += changedElementsCount;

        return {
          code: magicString.toString(),
          map: magicString.generateMap({ hires: true }),
        };
      } catch (error) {
        console.error(`Error processing file ${relativePath}:`, error);
        stats.processedFiles++;
        return null;
      }
    },

    // Optional: Add a way to see statistics
    closeBundle() {
      console.log('\nComponent Tagger Statistics:');
      console.log(`Total files scanned: ${stats.totalFiles}`);
      console.log(`Files processed: ${stats.processedFiles}`);
      console.log(`Elements tagged: ${stats.totalElements}\n`);
    },
  };
}
