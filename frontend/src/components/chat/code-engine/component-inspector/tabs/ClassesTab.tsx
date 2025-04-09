import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, PlusCircle, Save, RotateCcw } from 'lucide-react';
import { ClassesTabProps } from '../types';
import { updateElementStyle } from '../utils/iframe-utils';

/**
 * Classes tab - Displays and manages classes for the selected component
 */
export const ClassesTab: React.FC<ClassesTabProps> = ({
  selectedComponent,
  isStyleEdited,
  applyingChanges,
  saveClassesToFile,
  setCustomStyles,
  setIsStyleEdited
}) => {
  const [newClass, setNewClass] = useState<string>('');
  const [activeClasses, setActiveClasses] = useState<string[]>([]);
  const [removedClasses, setRemovedClasses] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [pendingSave, setPendingSave] = useState<boolean>(false);
  
  // Track original classes for the current component
  const originalClassesRef = useRef<string[]>([]);
  // Track the current component ID to detect component changes
  const previousComponentIdRef = useRef<string | null>(null);
  
  // Initialize the classes when a component is selected
  useEffect(() => {
    console.log('Component selected in ClassesTab:', selectedComponent);
    
    if (selectedComponent && selectedComponent.id) {
      // Check if this is a different component than before
      const isNewComponent = previousComponentIdRef.current !== selectedComponent.id;
      
      if (isNewComponent) {
        console.log('New component selected, resetting state');
        // Get classes from various possible sources
        let classString = '';
        
        // 1. Try to get from className property directly 
        if (selectedComponent.className) {
          classString = selectedComponent.className;
        } 
        // 2. Try to get from the data-custom-content which is parsed into the content field
        else if (selectedComponent.content) {
          // The content field might have className as part of its parsed JSON object
          try {
            // Check if the content field has className data
            const contentObj = selectedComponent.content as any;
            if (contentObj && typeof contentObj === 'object' && contentObj.className) {
              classString = contentObj.className;
            }
          } catch (err) {
            console.error('Error parsing content for className:', err);
          }
        }
        // 3. Try to extract from the attributes
        else if (selectedComponent.attributes && selectedComponent.attributes.class) {
          classString = selectedComponent.attributes.class;
        }
        
        console.log('Found class string:', classString);
        
        if (classString) {
          const classes = classString.split(' ')
            .filter(Boolean)
            .map(cls => cls.trim());
          
          // Store original classes and set active classes
          originalClassesRef.current = [...classes];
          setActiveClasses(classes);
          
          // Reset removed classes for new component
          setRemovedClasses([]);
          setHasChanges(false);
        } else {
          // No classes found
          originalClassesRef.current = [];
          setActiveClasses([]);
          setRemovedClasses([]);
          setHasChanges(false);
        }
        
        // Update the current component ID
        previousComponentIdRef.current = selectedComponent.id;
      }
    } else {
      // No component selected
      originalClassesRef.current = [];
      setActiveClasses([]);
      setRemovedClasses([]);
      setHasChanges(false);
      previousComponentIdRef.current = null;
    }
  }, [selectedComponent?.id]);
  
  // Effect to trigger file save after custom styles are set
  useEffect(() => {
    if (pendingSave && selectedComponent) {
      // Perform the actual save
      saveClassesToFile();
      
      // Update original classes reference to match the current active classes
      originalClassesRef.current = [...activeClasses];
      
      // Reset removed classes as we've committed the changes
      setRemovedClasses([]);
      
      // Reset states
      setHasChanges(false);
      setPendingSave(false);
    }
  }, [pendingSave, saveClassesToFile, selectedComponent, activeClasses]);
  
  // Apply class changes to the component in the iframe
  const applyClassChanges = () => {
    if (!selectedComponent || !selectedComponent.id) return;
    
    console.log('Applying class changes, new classes:', activeClasses.join(' '));
    
    // Update the element's class in the iframe to show visual changes immediately
    updateElementStyle(selectedComponent.id, {
      class: activeClasses.join(' ')
    });
    
    // Mark that we have changes that need to be saved
    setHasChanges(true);
    setIsStyleEdited(true);
  };
  
  // Handle saving classes to file
  const handleSaveClasses = () => {
    if (!selectedComponent || !hasChanges) return;
    
    // Get the current active classes as a single string
    const classString = activeClasses.join(' ');
    
    console.log('Saving classes:', classString);
    
    // Update customStyles with the className
    setCustomStyles({
      className: classString
    });
    
    // Set pendingSave flag to trigger the effect that will save the file
    setPendingSave(true);
  };
  
  // Reset to original classes
  const handleResetClasses = () => {
    if (!selectedComponent || !selectedComponent.id) return;
    
    console.log('Resetting to original classes:', originalClassesRef.current);
    
    // Restore original classes
    setActiveClasses([...originalClassesRef.current]);
    setRemovedClasses([]);
    setHasChanges(false);
    
    // Apply visual change
    updateElementStyle(selectedComponent.id, {
      class: originalClassesRef.current.join(' ')
    });
  };
  
  // Handle adding a new class
  const handleAddClass = () => {
    if (!newClass.trim()) return;
    
    // Check if class already exists
    if (!activeClasses.includes(newClass)) {
      // Create updated classes array with the new class added
      const updatedClasses = [...activeClasses, newClass];
      
      // Update our state
      setActiveClasses(updatedClasses);
      
      // If it was previously removed, take it out of removedClasses
      if (removedClasses.includes(newClass)) {
        setRemovedClasses(removedClasses.filter(c => c !== newClass));
      }
      
      // Apply changes directly to the component in the DOM
      if (selectedComponent && selectedComponent.id) {
        console.log('Adding new class:', newClass);
        console.log('Updated classes:', updatedClasses.join(' '));
        
        // Use the updated array directly to ensure immediate visual update
        updateElementStyle(selectedComponent.id, {
          class: updatedClasses.join(' ')
        });
        
        // Mark changes
        setHasChanges(true);
        setIsStyleEdited(true);
      }
    }
    
    // Clear the input field
    setNewClass('');
  };
  
  // Handle removing a class
  const handleRemoveClass = (classToRemove: string) => {
    // Filter out the class to remove
    const updatedClasses = activeClasses.filter(c => c !== classToRemove);
    
    // Update our state with the filtered classes
    setActiveClasses(updatedClasses);
    
    // Add to removed classes only if it was in the original set
    if (originalClassesRef.current.includes(classToRemove) && 
        !removedClasses.includes(classToRemove)) {
      setRemovedClasses([...removedClasses, classToRemove]);
    }
    
    // Apply changes to the component's class directly in the DOM
    if (selectedComponent && selectedComponent.id) {
      console.log('Applying class removal, removed class:', classToRemove);
      console.log('New classes after removal:', updatedClasses.join(' '));
      
      // Important: use the updated classes array directly instead of the state
      // which might not be updated yet due to React's async state updates
      updateElementStyle(selectedComponent.id, {
        class: updatedClasses.join(' ') // Note: use 'class' not 'className' for the DOM attribute
      });
      
      // Mark that we have changes that need to be saved
      setHasChanges(true);
      setIsStyleEdited(true);
    }
  };
  
  // Restore a removed class
  const handleRestoreClass = (classToRestore: string) => {
    // Remove from removedClasses
    setRemovedClasses(removedClasses.filter(c => c !== classToRestore));
    
    // Add back to activeClasses
    const updatedClasses = [...activeClasses, classToRestore];
    setActiveClasses(updatedClasses);
    
    // Apply changes directly using the updated classes array
    if (selectedComponent && selectedComponent.id) {
      updateElementStyle(selectedComponent.id, {
        class: updatedClasses.join(' ') // Note: use 'class' not 'className' for the DOM attribute
      });
      
      // Mark that we have changes
      setHasChanges(true);
      setIsStyleEdited(true);
    }
  };
  
  // Get tailwind groups (utility-first categories)
  const getTailwindGroups = () => {
    const groups: { [key: string]: string[] } = {
      Layout: [],
      Spacing: [],
      Sizing: [],
      Typography: [],
      Backgrounds: [],
      Borders: [],
      Effects: [],
      Flexbox: [],
      Grid: [],
      Positioning: [],
      Other: []
    };
    
    activeClasses.forEach(cls => {
      // Categorize classes based on prefix
      if (cls.startsWith('p-') || cls.startsWith('m-') || cls.startsWith('gap-')) {
        groups.Spacing.push(cls);
      } else if (cls.startsWith('w-') || cls.startsWith('h-') || cls.startsWith('min-')) {
        groups.Sizing.push(cls);
      } else if (cls.startsWith('text-') || cls.startsWith('font-') || cls.startsWith('leading-')) {
        groups.Typography.push(cls);
      } else if (cls.startsWith('bg-') || cls.startsWith('from-') || cls.startsWith('to-')) {
        groups.Backgrounds.push(cls);
      } else if (cls.startsWith('border-') || cls.startsWith('rounded-')) {
        groups.Borders.push(cls);
      } else if (cls.startsWith('shadow-') || cls.startsWith('opacity-') || cls.startsWith('transform-')) {
        groups.Effects.push(cls);
      } else if (cls.startsWith('flex-') || cls.startsWith('items-') || cls.startsWith('justify-')) {
        groups.Flexbox.push(cls);
      } else if (cls.startsWith('grid-') || cls.startsWith('col-') || cls.startsWith('row-')) {
        groups.Grid.push(cls);
      } else if (cls.startsWith('absolute') || cls.startsWith('relative') || cls.startsWith('static')) {
        groups.Positioning.push(cls);
      } else if (cls.startsWith('block') || cls.startsWith('inline') || cls.startsWith('hidden')) {
        groups.Layout.push(cls);
      } else {
        groups.Other.push(cls);
      }
    });
    
    // Filter out empty groups
    return Object.entries(groups).filter(([_, classes]) => classes.length > 0);
  };
  
  if (!selectedComponent) {
    return (
      <div className="p-3 sm:p-5 m-0 flex flex-col items-center justify-center h-full text-center">
        <div className="text-muted-foreground">
          <p>No component selected</p>
          <p className="text-xs mt-1">Click an element to inspect its classes</p>
        </div>
      </div>
    );
  }
  
  const tailwindGroups = getTailwindGroups();
  
  return (
    <ScrollArea className="h-auto overflow-auto">
      <div className="p-3 sm:p-5 m-0">
        {/* Header with class count */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-sm font-semibold">
              Classes 
              <Badge variant="secondary" className="ml-2 text-xs">
                {activeClasses.length}
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">Manage component classes</p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={handleResetClasses}
              disabled={applyingChanges || !hasChanges}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
            <Button
              variant="default"
              size="sm"
              className="text-xs h-8"
              onClick={handleSaveClasses}
              disabled={applyingChanges || !hasChanges}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Classes
            </Button>
          </div>
        </div>
        
        {/* Add new class */}
        <div className="mb-4">
          <div className="flex space-x-2">
            <Input
              className="h-8 text-xs"
              placeholder="Add class (e.g., text-blue-500)"
              value={newClass}
              onChange={(e) => setNewClass(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddClass();
                }
              }}
            />
            <Button
              className="h-8 px-3"
              size="sm"
              onClick={handleAddClass}
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>
        
        {/* Classes list grouped by type */}
        <div className="space-y-3">
          {tailwindGroups.map(([groupName, classes]) => (
            <div key={groupName} className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">{groupName}</h4>
              <div className="flex flex-wrap gap-1.5">
                {classes.map((cls) => (
                  <Badge 
                    key={cls} 
                    variant="outline" 
                    className="px-2 py-0.5 text-xs font-mono flex items-center gap-1 max-w-full bg-gray-50 dark:bg-zinc-900"
                  >
                    <span className="truncate">{cls}</span>
                    <button
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      onClick={() => handleRemoveClass(cls)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          
          {/* Show empty state if no classes */}
          {tailwindGroups.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <p>No classes added yet</p>
              <p className="text-xs mt-1">Add classes above to style this component</p>
            </div>
          )}
        </div>
        
        {/* Removed classes (for reference) */}
        {removedClasses.length > 0 && (
          <div className="mt-6 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">Removed Classes</h4>
            <div className="flex flex-wrap gap-1.5">
              {removedClasses.map((cls) => (
                <Badge 
                  key={cls} 
                  variant="outline" 
                  className="px-2 py-0.5 text-xs font-mono bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                >
                  <span className="line-through">{cls}</span>
                  <button
                    className="ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={() => handleRestoreClass(cls)}
                  >
                    <PlusCircle className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}; 