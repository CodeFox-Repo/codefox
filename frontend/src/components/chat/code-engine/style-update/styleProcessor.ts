import { StyleChanges } from './index';

/**
 * Utility class for processing styles
 */
export class StyleProcessor {
  /**
   * Process input styles before converting to Tailwind or applying inline
   * This can be used for validating or transforming style values
   */
  static processStyles(styles: StyleChanges): StyleChanges {
    const processedStyles: StyleChanges = {};

    // Process each style property
    for (const [property, value] of Object.entries(styles)) {
      // Add 'px' to numeric values for certain properties if they don't already have units
      if (
        this.shouldAddPxUnits(property) &&
        this.isNumeric(value) &&
        !value.toString().match(/[a-z%]/i)
      ) {
        processedStyles[property] = `${value}px`;
      } else {
        processedStyles[property] = value;
      }
    }

    return processedStyles;
  }

  /**
   * Check if a property should have 'px' units added to numeric values
   */
  private static shouldAddPxUnits(property: string): boolean {
    // Properties that typically need 'px' units for numeric values
    const pxProperties = [
      'width',
      'height',
      'minWidth',
      'minHeight',
      'maxWidth',
      'maxHeight',
      'margin',
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft',
      'padding',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'top',
      'right',
      'bottom',
      'left',
      'fontSize',
      'lineHeight',
      'borderWidth',
      'borderRadius',
      'gap',
      'columnGap',
      'rowGap',
    ];

    return pxProperties.includes(property);
  }

  /**
   * Check if a value is numeric
   */
  private static isNumeric(value: any): boolean {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }

  /**
   * Normalize style properties (e.g., convert shorthand properties to longhand)
   * This can be expanded as needed for more complex style processing
   */
  static normalizeStyles(styles: StyleChanges): StyleChanges {
    const normalized: StyleChanges = { ...styles };

    // Handle margin shorthand
    if (styles.margin) {
      const values = this.parseShorthandValue(styles.margin);

      if (values.length === 1) {
        // Same for all sides
        normalized.marginTop = values[0];
        normalized.marginRight = values[0];
        normalized.marginBottom = values[0];
        normalized.marginLeft = values[0];
      } else if (values.length === 2) {
        // vertical horizontal
        normalized.marginTop = values[0];
        normalized.marginBottom = values[0];
        normalized.marginRight = values[1];
        normalized.marginLeft = values[1];
      } else if (values.length === 4) {
        // top right bottom left
        normalized.marginTop = values[0];
        normalized.marginRight = values[1];
        normalized.marginBottom = values[2];
        normalized.marginLeft = values[3];
      }
    }

    // Handle padding shorthand
    if (styles.padding) {
      const values = this.parseShorthandValue(styles.padding);

      if (values.length === 1) {
        // Same for all sides
        normalized.paddingTop = values[0];
        normalized.paddingRight = values[0];
        normalized.paddingBottom = values[0];
        normalized.paddingLeft = values[0];
      } else if (values.length === 2) {
        // vertical horizontal
        normalized.paddingTop = values[0];
        normalized.paddingBottom = values[0];
        normalized.paddingRight = values[1];
        normalized.paddingLeft = values[1];
      } else if (values.length === 4) {
        // top right bottom left
        normalized.paddingTop = values[0];
        normalized.paddingRight = values[1];
        normalized.paddingBottom = values[2];
        normalized.paddingLeft = values[3];
      }
    }

    return normalized;
  }

  /**
   * Parse shorthand value like "10px 20px" into array of values
   */
  private static parseShorthandValue(value: string): string[] {
    return value.split(/\s+/).filter(Boolean);
  }

  /**
   * Merge style objects, with the second object's properties overriding the first
   */
  static mergeStyles(
    baseStyles: StyleChanges,
    overrideStyles: StyleChanges
  ): StyleChanges {
    return {
      ...baseStyles,
      ...overrideStyles,
    };
  }

  /**
   * Filter styles to include only specified properties
   */
  static filterStyles(
    styles: StyleChanges,
    properties: string[]
  ): StyleChanges {
    const filtered: StyleChanges = {};

    for (const property of properties) {
      if (styles[property] !== undefined) {
        filtered[property] = styles[property];
      }
    }

    return filtered;
  }
}
