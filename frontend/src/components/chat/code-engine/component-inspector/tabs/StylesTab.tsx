import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, RotateCcw } from 'lucide-react';
import { StylesTabProps } from '../types';
import { SpacingControls } from '../components/SpacingControls';
import { ColorPicker } from '../components/ColorPicker';
import { getColorValue } from '../utils/color-utils';
import { haveStylesChanged } from '../utils/style-utils';
import { updateElementStyle } from '../utils/iframe-utils';

/**
 * Styles tab - Displays and manages layout and color styles for the selected component
 */
export const StylesTab: React.FC<StylesTabProps> = ({
  selectedComponent,
  computedStyles,
  customStyles,
  isStyleEdited,
  applyingChanges,
  spacingInputs,
  handleSpacingInputChange,
  handleStyleChange,
  applyStyleChanges,
  setIsStyleEdited,
  setCustomStyles,
  setSpacingInputs
}) => {
  // Active spacing section (padding or margin)
  const [activeSpacingSection, setActiveSpacingSection] = useState<'padding' | 'margin'>('padding');
  
  // Check if styles have changed
  useEffect(() => {
    // Use utility function to determine if styles have changed
    const stylesChanged = haveStylesChanged(customStyles, computedStyles);
    
    // Update isStyleEdited state if needed
    if (stylesChanged !== isStyleEdited) {
      setIsStyleEdited(stylesChanged);
    }
  }, [customStyles, computedStyles, isStyleEdited, setIsStyleEdited]);
  
  // Handle save button click
  const handleSaveStyles = () => {
    if (Object.keys(customStyles).length > 0) {
      applyStyleChanges();
    }
  };
  
  // Reset styles to original computed values
  const handleResetStyles = () => {
    // Create reset styles that explicitly set properties back to original values
    const resetStyles: Record<string, string> = {};
    
    // For every custom style that was changed, reset to computed value or empty string
    Object.keys(customStyles).forEach(property => {
      if (computedStyles && computedStyles[property]) {
        // Reset to original computed value
        resetStyles[property] = computedStyles[property];
      } else {
        // If no computed value exists, set to empty to remove it
        resetStyles[property] = '';
      }
      
      // For padding and margin properties, ensure we reset all related properties
      if (property === 'padding' || property === 'margin') {
        console.log(`Resetting ${property} and all its sides`);
        
        // Define the individual side properties
        const sides = property === 'padding' 
          ? ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
          : ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'];
        
        // Reset each individual side
        sides.forEach(side => {
          if (computedStyles && computedStyles[side]) {
            resetStyles[side] = computedStyles[side];
          } else {
            resetStyles[side] = '';
          }
        });
      }
    });
    
    // Also reset any spacing inputs
    const resetSpacingInputs: Record<string, string> = {};
    
    // Apply the reset styles to visually revert the component
    if (selectedComponent) {
      console.log('Resetting styles to:', resetStyles);
      updateElementStyle(selectedComponent.id, resetStyles);
    }
    
    // Clear all custom styles
    setCustomStyles({});
    
    // Reset spacing inputs - we need to explicitly set each one to an empty string
    // or its original computed value to clear the UI inputs
    if (computedStyles) {
      const spacingProperties = [
        'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft'
      ];
      
      spacingProperties.forEach(prop => {
        if (computedStyles[prop]) {
          resetSpacingInputs[prop] = computedStyles[prop].replace('px', '');
        } else {
          resetSpacingInputs[prop] = '';
        }
      });
    }
    
    setSpacingInputs(resetSpacingInputs);
    
    // Reset edited state
    setIsStyleEdited(false);
  };
  
  // Reset a specific spacing property (padding or margin)
  const handleResetSpacing = (mainProperty: 'padding' | 'margin') => {
    console.log(`Specifically resetting ${mainProperty} and all sides`);
    
    // Create reset styles
    const resetStyles: Record<string, string> = {};
    
    // Define the side properties
    const sides = mainProperty === 'padding' 
      ? ['padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
      : ['margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft'];
    
    // Reset each property
    sides.forEach(side => {
      if (computedStyles && computedStyles[side]) {
        resetStyles[side] = computedStyles[side];
      } else {
        resetStyles[side] = '';
      }
      
      // Also remove from customStyles if it exists
      if (customStyles[side]) {
        const updatedCustomStyles = { ...customStyles };
        delete updatedCustomStyles[side];
        setCustomStyles(updatedCustomStyles);
      }
    });
    
    // Reset spacing inputs
    const updatedSpacingInputs = { ...spacingInputs };
    sides.forEach(side => {
      if (computedStyles && computedStyles[side]) {
        updatedSpacingInputs[side] = computedStyles[side].replace('px', '');
      } else {
        updatedSpacingInputs[side] = '';
      }
    });
    setSpacingInputs(updatedSpacingInputs);
    
    // Apply visual change immediately
    if (selectedComponent) {
      updateElementStyle(selectedComponent.id, resetStyles);
    }
  };
  
  if (!selectedComponent) {
    return (
      <div className="p-3 sm:p-5 m-0 flex flex-col items-center justify-center h-full text-center">
        <div className="text-muted-foreground">
          <p>No component selected</p>
          <p className="text-xs mt-1">Click an element to edit its styles</p>
        </div>
      </div>
    );
  }
  
  // Get display values for spacing inputs
  const getSpacingDisplayValue = (property: string): string => {
    // First show what the user is actively typing
    if (spacingInputs[property] !== undefined) {
      // Log for debugging
      console.log(`Display value for ${property}: ${spacingInputs[property]} (from input)`);
      return spacingInputs[property];
    }
    
    // Then show what's in the style application queue
    if (customStyles[property]) {
      const value = customStyles[property].replace('px', '');
      console.log(`Display value for ${property}: ${value} (from customStyles)`);
      return value;
    }
    
    // Finally fall back to computed styles if available
    if (computedStyles && computedStyles[property]) {
      const value = computedStyles[property].replace('px', '');
      console.log(`Display value for ${property}: ${value} (from computedStyles)`);
      return value;
    }
    
    console.log(`No display value found for ${property}`);
    return '';
  };
  
  return (
    <ScrollArea className="h-auto overflow-auto">
      <div className="p-3 sm:p-5 m-0">
        {/* Header with save button */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-sm font-semibold">Layout & Colors</h3>
            <p className="text-xs text-muted-foreground">Edit the component styling</p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={handleResetStyles}
              disabled={!isStyleEdited || applyingChanges}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
            <Button
              variant="default"
              size="sm"
              className="text-xs h-8"
              onClick={handleSaveStyles}
              disabled={!isStyleEdited || applyingChanges || Object.keys(customStyles).length === 0}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Styles
            </Button>
          </div>
        </div>
        
        {/* Colors section */}
        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-md p-3 sm:p-4 mb-4">
          <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
            Colors
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ColorPicker
              style="color"
              label="Text Color"
              color={customStyles.color || (computedStyles?.color || '#000000')}
              onChange={handleStyleChange}
            />
            <ColorPicker
              style="backgroundColor"
              label="Background"
              color={customStyles.backgroundColor || (computedStyles && computedStyles.backgroundColor ? computedStyles.backgroundColor : '#ffffff')}
              onChange={handleStyleChange}
            />
          </div>
        </div>
        
        {/* Spacing section (Padding & Margin) */}
        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-md p-3 sm:p-4 mb-4">
          <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
            Spacing
          </h4>
          
          {/* Tabs for Padding vs Margin */}
          <div className="flex border-b border-gray-200 dark:border-zinc-700 mb-3">
            <button
              className={`text-xs py-2 px-4 font-medium ${
                activeSpacingSection === 'padding'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              onClick={() => setActiveSpacingSection('padding')}
            >
              Padding
            </button>
            <button
              className={`text-xs py-2 px-4 font-medium ${
                activeSpacingSection === 'margin'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              onClick={() => setActiveSpacingSection('margin')}
            >
              Margin
            </button>
            
            {/* Add a reset button for just padding/margin */}
            <div className="ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleResetSpacing(activeSpacingSection)}
                title={`Reset ${activeSpacingSection} values`}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset {activeSpacingSection}
              </Button>
            </div>
          </div>
          
          {/* Padding controls */}
          {activeSpacingSection === 'padding' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <SpacingControls
                property="paddingTop"
                label="Top"
                displayValue={getSpacingDisplayValue('paddingTop')}
                onValueChange={handleSpacingInputChange}
              />
              <SpacingControls
                property="paddingRight"
                label="Right"
                displayValue={getSpacingDisplayValue('paddingRight')}
                onValueChange={handleSpacingInputChange}
              />
              <SpacingControls
                property="paddingBottom"
                label="Bottom"
                displayValue={getSpacingDisplayValue('paddingBottom')}
                onValueChange={handleSpacingInputChange}
              />
              <SpacingControls
                property="paddingLeft"
                label="Left"
                displayValue={getSpacingDisplayValue('paddingLeft')}
                onValueChange={handleSpacingInputChange}
              />
              
              {/* All sides padding */}
              <div className="col-span-1 sm:col-span-2 border-t border-gray-200 dark:border-zinc-700 pt-3">
                <SpacingControls
                  property="padding"
                  label="All Sides"
                  pairedProperty="padding"
                  displayValue={getSpacingDisplayValue('padding')}
                  onValueChange={handleSpacingInputChange}
                />
              </div>
            </div>
          )}
          
          {/* Margin controls */}
          {activeSpacingSection === 'margin' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <SpacingControls
                property="marginTop"
                label="Top"
                displayValue={getSpacingDisplayValue('marginTop')}
                onValueChange={handleSpacingInputChange}
              />
              <SpacingControls
                property="marginRight"
                label="Right"
                displayValue={getSpacingDisplayValue('marginRight')}
                onValueChange={handleSpacingInputChange}
              />
              <SpacingControls
                property="marginBottom"
                label="Bottom"
                displayValue={getSpacingDisplayValue('marginBottom')}
                onValueChange={handleSpacingInputChange}
              />
              <SpacingControls
                property="marginLeft"
                label="Left"
                displayValue={getSpacingDisplayValue('marginLeft')}
                onValueChange={handleSpacingInputChange}
              />
              
              {/* All sides margin */}
              <div className="col-span-1 sm:col-span-2 border-t border-gray-200 dark:border-zinc-700 pt-3">
                <SpacingControls
                  property="margin"
                  label="All Sides"
                  pairedProperty="margin"
                  displayValue={getSpacingDisplayValue('margin')}
                  onValueChange={handleSpacingInputChange}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Layout section (Display, Position, Size) */}
        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-md p-3 sm:p-4">
          <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
            Layout
          </h4>
          
          {/* Overflow property */}
          <div>
            <h5 className="text-xs font-medium mb-2">Overflow</h5>
            <div className="flex flex-wrap gap-1.5">
              {['visible', 'hidden', 'scroll', 'auto'].map(overflow => (
                <Button
                  key={overflow}
                  size="sm"
                  variant={(customStyles.overflow || computedStyles?.overflow) === overflow ? "default" : "outline"}
                  className={`h-7 text-xs ${(customStyles.overflow || computedStyles?.overflow) === overflow ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}`}
                  onClick={() => handleStyleChange('overflow', overflow)}
                  onDoubleClick={() => {
                    // On double-click, clear the overflow property if it's currently selected
                    if (customStyles.overflow === overflow) {
                      console.log('Double-clicked to clear overflow', overflow);
                      
                      // Create a new customStyles object without the overflow property
                      const newCustomStyles = { ...customStyles };
                      delete newCustomStyles.overflow;
                      
                      // Update the styles
                      setCustomStyles(newCustomStyles);
                      
                      // Apply the change visually
                      if (selectedComponent) {
                        updateElementStyle(selectedComponent.id, {
                          ...newCustomStyles,
                          overflow: 'initial' // Set to initial to clear the property
                        });
                      }
                      
                      // Mark as edited if there are still other custom styles
                      setIsStyleEdited(Object.keys(newCustomStyles).length > 0);
                    }
                  }}
                >
                  {overflow}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}; 