import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorPickerProps } from '../types';
import { getColorValue } from '../utils/color-utils';

/**
 * Component for selecting and displaying color values
 */
export const ColorPicker: React.FC<ColorPickerProps> = ({
  style,
  label,
  color,
  onChange
}) => {
  // Get a clean color value
  const displayColor = getColorValue(color);
  
  return (
    <div>
      <Label htmlFor={`${style}-input`} className="text-xs mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        <code className="text-xs bg-gray-100 dark:bg-zinc-900 px-1 rounded">
          {displayColor}
        </code>
      </Label>
      <div className="flex gap-2">
        <input
          id={`${style}-color`}
          name={`${style}-color`}
          type="color"
          value={displayColor}
          onChange={(e) => onChange(style, e.target.value)}
          className="w-10 h-10 p-1 rounded-full overflow-hidden"
        />
        <Input
          id={`${style}-input`}
          type="text"
          value={displayColor}
          onChange={(e) => onChange(style, e.target.value)}
          className="flex-1 h-8 text-xs"
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      </div>
    </div>
  );
}; 