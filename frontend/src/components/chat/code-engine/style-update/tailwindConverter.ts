import { StyleChanges } from './index';

/**
 * Utility class for converting CSS styles to Tailwind classes
 */
export class TailwindConverter {
  /**
   * Convert style object to Tailwind classes
   */
  static stylesToTailwindClasses(styles: StyleChanges): string[] {
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
  static colorToTailwind(color: string, prefix: string): string {
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
  static sanitizeArbitraryValue(value: string): string {
    // Replace any characters that might conflict with JSX syntax
    return value.replace(/[<>]/g, '');
  }

  /**
   * Convert font size values to Tailwind classes
   */
  static fontSizeToTailwind(fontSize: string): string {
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
  static fontWeightToTailwind(fontWeight: string): string {
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
  static spacingToTailwind(spacing: string, prefix: string): string {
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
}
