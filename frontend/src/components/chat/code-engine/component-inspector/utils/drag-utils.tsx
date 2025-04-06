/**
 * Utility functions for drag interactions
 */
import React from 'react';

/**
 * DragStyles component - Adds global styles for drag operations
 */
export const DragStyles: React.FC = () => (
  <style dangerouslySetInnerHTML={{
    __html: `
      .dragging-spacing {
        cursor: ew-resize !important;
      }
      .dragging-spacing * {
        cursor: ew-resize !important;
        user-select: none !important;
      }
      .cursor-ew-resize:hover {
        cursor: ew-resize;
      }
    `
  }} />
);

/**
 * Handler for mouse drag to adjust numeric values
 * @param property - The property being adjusted
 * @param startValue - Initial value when drag starts
 * @param e - Mouse event
 * @param callback - Function to call when value changes
 * @param pairedProperty - Optional paired property name (for paired spacing)
 * @param sensitivity - Drag sensitivity multiplier
 */
export const handleMouseDrag = (
  property: string,
  startValue: number,
  e: React.MouseEvent,
  callback: (property: string, value: string) => void,
  pairedProperty?: string
): void => {
  e.preventDefault();
  
  const startX = e.clientX;
  const sensitivity = 0.5; // How many pixels mouse movement = 1px change
  
  // Add a class to the body to change cursor during drag
  document.body.classList.add('dragging-spacing');
  
  const onMouseMove = (moveEvent: MouseEvent) => {
    moveEvent.preventDefault();
    
    // Calculate the drag distance and convert to value change
    const deltaX = moveEvent.clientX - startX;
    const newValue = Math.max(0, Math.round(startValue + (deltaX * sensitivity)));
    
    // Update via callback
    callback(property, newValue.toString());
    
    // Update paired property if specified
    if (pairedProperty) {
      callback(pairedProperty, newValue.toString());
    }
  };
  
  const onMouseUp = () => {
    // Remove the cursor style
    document.body.classList.remove('dragging-spacing');
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}; 