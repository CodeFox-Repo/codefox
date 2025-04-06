/**
 * Utility functions for style manipulation and processing
 */
import { ComputedStyles, CustomStyles, SpacingInputs } from '../types';

/**
 * Add 'px' unit to numeric values if not present
 * @param value - The value to process
 * @returns Value with 'px' added if needed
 */
export const addPxUnitIfNeeded = (value: string): string => {
  if (!value) return value;

  // If it's a number without units, add px
  if (/^\d+$/.test(value)) {
    return `${value}px`;
  }

  return value;
};

/**
 * Remove 'px' unit from a value
 * @param value - The value to process
 * @returns Value without 'px' unit
 */
export const removePxUnit = (value: string): string => {
  if (!value) return '';
  return value.replace('px', '');
};

/**
 * Initialize spacing inputs from computed styles
 * @param styles - Computed styles object
 * @returns Initialized spacing inputs object
 */
export const initializeSpacingInputs = (
  styles: ComputedStyles
): SpacingInputs => {
  const spacingProperties = [
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
  ];

  const initialSpacingInputs: SpacingInputs = {};

  spacingProperties.forEach((prop) => {
    if (styles[prop]) {
      initialSpacingInputs[prop] = styles[prop].replace('px', '');
    }
  });

  return initialSpacingInputs;
};

/**
 * Check if custom styles have changed compared to computed styles
 * @param customStyles - Custom styles object
 * @param computedStyles - Computed styles object
 * @returns True if styles have changed
 */
export const haveStylesChanged = (
  customStyles: Record<string, string>,
  computedStyles: Record<string, string> | null
): boolean => {
  if (!computedStyles) return Object.keys(customStyles).length > 0;

  // Check if any custom style differs from computed style
  return Object.entries(customStyles).some(
    ([key, value]) => computedStyles[key] !== value
  );
};

/**
 * Format style property name for display
 * @param property - CSS property name in camelCase
 * @returns Formatted property name
 */
export const formatStyleProperty = (property: string): string => {
  // Convert camelCase to kebab-case
  const kebabCase = property
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

  // Format special cases
  switch (kebabCase) {
    case 'background-color':
      return 'Background';
    case 'color':
      return 'Text Color';
    case 'font-size':
      return 'Font Size';
    case 'font-weight':
      return 'Font Weight';
    case 'text-align':
      return 'Text Align';
    case 'padding-top':
      return 'Padding Top';
    case 'padding-right':
      return 'Padding Right';
    case 'padding-bottom':
      return 'Padding Bottom';
    case 'padding-left':
      return 'Padding Left';
    case 'margin-top':
      return 'Margin Top';
    case 'margin-right':
      return 'Margin Right';
    case 'margin-bottom':
      return 'Margin Bottom';
    case 'margin-left':
      return 'Margin Left';
    default:
      // Capitalize first letter of each word
      return kebabCase
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  }
};

/**
 * Converts CSS properties to Tailwind classes
 */
export function cssToTailwind(property: string, value: string): string | null {
  // This is a simplified implementation - would need a more comprehensive mapping
  // for a real converter

  // Font size mapping
  if (property === 'fontSize') {
    const sizes: Record<string, string> = {
      '12px': 'text-xs',
      '14px': 'text-sm',
      '16px': 'text-base',
      '18px': 'text-lg',
      '20px': 'text-xl',
      '24px': 'text-2xl',
      '30px': 'text-3xl',
      '36px': 'text-4xl',
    };
    return sizes[value] || null;
  }

  // Font weight mapping
  if (property === 'fontWeight') {
    const weights: Record<string, string> = {
      '100': 'font-thin',
      '200': 'font-extralight',
      '300': 'font-light',
      '400': 'font-normal',
      '500': 'font-medium',
      '600': 'font-semibold',
      '700': 'font-bold',
      '800': 'font-extrabold',
      '900': 'font-black',
    };
    return weights[value] || null;
  }

  return null;
}
