/**
 * Utility functions for drag interactions
 */

// Global style tag for drag styles
export const DragStyles = (): JSX.Element => (
  <style jsx global>{`
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
  `}</style>
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
  callback: (property: string, value: string, bothSides?: boolean, pairedProperty?: string) => void,
  pairedProperty?: string,
  sensitivity: number = 0.3
): void => {
  e.preventDefault();
  
  const startX = e.clientX;
  let currentValue = startValue;
  
  // Add a class to the body to change cursor during drag
  document.body.classList.add('dragging-spacing');
  
  const onMouseMove = (moveEvent: MouseEvent): void => {
    moveEvent.preventDefault();
    
    // Calculate the drag distance and convert to value change
    const deltaX = moveEvent.clientX - startX;
    const newValue = Math.max(0, Math.round(currentValue + (deltaX * sensitivity)));
    
    // Update the value
    callback(property, newValue.toString(), !!pairedProperty, pairedProperty);
  };
  
  const onMouseUp = (): void => {
    // Remove the cursor style
    document.body.classList.remove('dragging-spacing');
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}; 