import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, PlusCircle, Save } from 'lucide-react';
import { ClassesTabProps } from '../types';

/**
 * Classes tab - Displays and manages classes for the selected component
 */
export const ClassesTab: React.FC<ClassesTabProps> = ({
  selectedComponent,
  isStyleEdited,
  applyingChanges,
  saveClassesToFile
}) => {
  const [newClass, setNewClass] = useState<string>('');
  const [activeClasses, setActiveClasses] = useState<string[]>([]);
  const [removedClasses, setRemovedClasses] = useState<string[]>([]);
  
  // Initialize the classes when a component is selected
  React.useEffect(() => {
    if (selectedComponent?.className) {
      const classes = selectedComponent.className.split(' ')
        .filter(Boolean)
        .map(cls => cls.trim());
      setActiveClasses(classes);
      setRemovedClasses([]);
    } else {
      setActiveClasses([]);
      setRemovedClasses([]);
    }
  }, [selectedComponent, selectedComponent?.className]);
  
  // Handle adding a new class
  const handleAddClass = () => {
    if (!newClass.trim()) return;
    
    // Check if class already exists
    if (!activeClasses.includes(newClass)) {
      setActiveClasses([...activeClasses, newClass]);
      
      // If it was previously removed, take it out of removedClasses
      if (removedClasses.includes(newClass)) {
        setRemovedClasses(removedClasses.filter(c => c !== newClass));
      }
    }
    
    setNewClass('');
  };
  
  // Handle removing a class
  const handleRemoveClass = (classToRemove: string) => {
    setActiveClasses(activeClasses.filter(c => c !== classToRemove));
    
    // Track original classes that were removed
    if (selectedComponent && 
        selectedComponent.className && 
        selectedComponent.className.includes(classToRemove)) {
      setRemovedClasses([...removedClasses, classToRemove]);
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
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={saveClassesToFile}
            disabled={applyingChanges}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save Classes
          </Button>
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
                    onClick={() => {
                      setRemovedClasses(removedClasses.filter(c => c !== cls));
                      setActiveClasses([...activeClasses, cls]);
                    }}
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