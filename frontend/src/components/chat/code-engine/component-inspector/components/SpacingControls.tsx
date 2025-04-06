import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { handleMouseDrag } from '../utils/drag-utils';
import { SpacingControlsProps } from '../types';
import { addPxUnitIfNeeded } from '../utils/style-utils';

/**
 * Component for adjusting spacing (padding/margin) values
 */
export const SpacingControls: React.FC<SpacingControlsProps> = ({
  property,
  label,
  pairedProperty,
  displayValue,
  onValueChange
}) => {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <Label htmlFor={`${property}-input`} className="text-xs flex items-center gap-1">
          <span>{label}</span>
          {displayValue && (
            <code className="text-xs bg-gray-100 dark:bg-zinc-800 px-1 rounded text-blue-500">
              {displayValue}px
            </code>
          )}
        </Label>
        <div className="flex space-x-1">
          <Button 
            type="button" 
            variant="outline" 
            size="icon" 
            className="h-5 w-5 rounded-full flex-shrink-0" 
            onClick={(e) => {
              const currentVal = parseInt(displayValue || "0");
              if (currentVal > 0) {
                const newVal = (currentVal - 1).toString();
                onValueChange(property, newVal, !!pairedProperty, pairedProperty);
              }
            }}
          >
            <span className="text-xs">-</span>
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="icon" 
            className="h-5 w-5 rounded-full flex-shrink-0" 
            onClick={(e) => {
              const currentVal = parseInt(displayValue || "0");
              const newVal = (currentVal + 1).toString();
              onValueChange(property, newVal, !!pairedProperty, pairedProperty);
            }}
          >
            <span className="text-xs">+</span>
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
        <div className="flex flex-1 items-center min-w-0">
          <Input
            id={`${property}-input`}
            name={property}
            type="number"
            min="0"
            value={displayValue}
            onChange={(e) => {
              onValueChange(property, e.target.value, !!pairedProperty, pairedProperty);
            }}
            className="h-7 text-xs flex-1 cursor-ew-resize"
            onMouseDown={(e) => {
              // Only use drag on the input (not on buttons or other elements)
              if (e.currentTarget === e.target) {
                handleMouseDrag(
                  property, 
                  parseInt(displayValue || "0"), 
                  e, 
                  onValueChange,
                  pairedProperty
                );
              }
            }}
          />
          <div className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-muted-foreground flex-shrink-0">
            px
          </div>
        </div>
        {pairedProperty && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-xs flex-shrink-0"
            title="Apply to all sides"
            onClick={() => {
              if (displayValue) {
                // Apply the same value to all sides (top, right, bottom, left)
                const sides = property.startsWith('padding') 
                  ? ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
                  : ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'];
                
                sides.forEach(side => {
                  const pixelValue = addPxUnitIfNeeded(displayValue);
                  onValueChange(side, displayValue, false);
                });
              }
            }}
          >
            <span className="text-[10px]">ALL</span>
          </Button>
        )}
      </div>
    </div>
  );
}; 