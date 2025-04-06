import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TypographyControlsProps } from '../types';

/**
 * Component for typography controls
 */
export const TypographyControls: React.FC<TypographyControlsProps> = ({
  customStyles,
  computedStyles,
  onChange
}) => {
  return (
    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-md p-3 sm:p-4 mt-4">
      <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center justify-between">
        <div className="flex items-center">
          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
          Typography
        </div>
        <div className="text-xs text-muted-foreground">
          <span>Saved with style changes</span>
        </div>
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <Label htmlFor="font-size" className="text-xs mb-1.5 flex items-center justify-between">
            <span>Font Size</span>
            <code className="text-xs bg-gray-100 dark:bg-zinc-900 px-1 rounded">
              {customStyles.fontSize || computedStyles?.fontSize || ''}
            </code>
          </Label>
          <select
            id="font-size"
            name="font-size"
            value={customStyles.fontSize || computedStyles?.fontSize || ''}
            onChange={(e) => {
              if (e.target.value === '') {
                // Clear the style if "Default" is selected
                const newStyles = {...customStyles};
                delete newStyles.fontSize;
                onChange('fontSize', '');
              } else {
                onChange('fontSize', e.target.value);
              }
            }}
            className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
          >
            <option value="">Default</option>
            <option value="0.75rem">text-xs (12px)</option>
            <option value="0.875rem">text-sm (14px)</option>
            <option value="1rem">text-base (16px)</option>
            <option value="1.125rem">text-lg (18px)</option>
            <option value="1.25rem">text-xl (20px)</option>
            <option value="1.5rem">text-2xl (24px)</option>
            <option value="1.875rem">text-3xl (30px)</option>
            <option value="2.25rem">text-4xl (36px)</option>
            <option value="3rem">text-5xl (48px)</option>
            <option value="3.75rem">text-6xl (60px)</option>
            <option value="4.5rem">text-7xl (72px)</option>
            <option value="6rem">text-8xl (96px)</option>
            <option value="8rem">text-9xl (128px)</option>
          </select>
        </div>
        <div>
          <Label htmlFor="font-weight" className="text-xs mb-1.5 flex items-center justify-between">
            <span>Font Weight</span>
            <code className="text-xs bg-gray-100 dark:bg-zinc-900 px-1 rounded">
              {customStyles.fontWeight || computedStyles?.fontWeight || ''}
            </code>
          </Label>
          <select
            id="font-weight"
            name="font-weight"
            value={customStyles.fontWeight || computedStyles?.fontWeight || ''}
            onChange={(e) => onChange('fontWeight', e.target.value)}
            className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
          >
            <option value="">Default</option>
            <option value="100">font-thin (100)</option>
            <option value="200">font-extralight (200)</option>
            <option value="300">font-light (300)</option>
            <option value="400">font-normal (400)</option>
            <option value="500">font-medium (500)</option>
            <option value="600">font-semibold (600)</option>
            <option value="700">font-bold (700)</option>
            <option value="800">font-extrabold (800)</option>
            <option value="900">font-black (900)</option>
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <Label htmlFor="letter-spacing" className="text-xs mb-1.5 flex items-center justify-between">
            <span>Letter Spacing</span>
            <code className="text-xs bg-gray-100 dark:bg-zinc-900 px-1 rounded">
              {customStyles.letterSpacing || computedStyles?.letterSpacing || ''}
            </code>
          </Label>
          <select
            id="letter-spacing"
            name="letter-spacing"
            value={customStyles.letterSpacing || computedStyles?.letterSpacing || ''}
            onChange={(e) => onChange('letterSpacing', e.target.value)}
            className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
          >
            <option value="">Default</option>
            <option value="-0.05em">tracking-tighter</option>
            <option value="-0.025em">tracking-tight</option>
            <option value="0">tracking-normal</option>
            <option value="0.025em">tracking-wide</option>
            <option value="0.05em">tracking-wider</option>
            <option value="0.1em">tracking-widest</option>
          </select>
        </div>
        <div>
          <Label htmlFor="line-height" className="text-xs mb-1.5 flex items-center justify-between">
            <span>Line Height</span>
            <code className="text-xs bg-gray-100 dark:bg-zinc-900 px-1 rounded">
              {customStyles.lineHeight || computedStyles?.lineHeight || ''}
            </code>
          </Label>
          <select
            id="line-height"
            name="line-height"
            value={customStyles.lineHeight || computedStyles?.lineHeight || ''}
            onChange={(e) => onChange('lineHeight', e.target.value)}
            className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
          >
            <option value="">Default</option>
            <option value="1">leading-none (1)</option>
            <option value="1.25">leading-tight (1.25)</option>
            <option value="1.375">leading-snug (1.375)</option>
            <option value="1.5">leading-normal (1.5)</option>
            <option value="1.625">leading-relaxed (1.625)</option>
            <option value="2">leading-loose (2)</option>
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <Label htmlFor="text-decoration" className="text-xs mb-1.5 flex items-center justify-between">
            <span>Text Decoration</span>
            <code className="text-xs bg-gray-100 dark:bg-zinc-900 px-1 rounded">
              {customStyles.textDecoration || computedStyles?.textDecoration || ''}
            </code>
          </Label>
          <select
            id="text-decoration"
            name="text-decoration"
            value={customStyles.textDecoration || computedStyles?.textDecoration || ''}
            onChange={(e) => onChange('textDecoration', e.target.value)}
            className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
          >
            <option value="">Default</option>
            <option value="underline">underline</option>
            <option value="line-through">line-through</option>
            <option value="overline">overline</option>
            <option value="none">none</option>
          </select>
        </div>
      </div>
      
      <div>
        <Label htmlFor="text-align" className="text-xs mb-1.5 block">Text Align</Label>
        <div className="flex gap-1">
          {['left', 'center', 'right', 'justify'].map(align => (
            <Button
              key={align}
              size="sm"
              variant={(customStyles.textAlign || computedStyles?.textAlign) === align ? "default" : "outline"}
              className={`flex-1 h-7 text-xs ${(customStyles.textAlign || computedStyles?.textAlign) === align ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                onChange('textAlign', align);
              }}
            >
              {align}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}; 