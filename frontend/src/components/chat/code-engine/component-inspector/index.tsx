import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ContentTab } from './tabs/ContentTab';
import { StylesTab } from './tabs/StylesTab';
import { ClassesTab } from './tabs/ClassesTab';
import { InfoTab } from './tabs/InfoTab';
import { DragStyles } from './utils/drag-utils';
import { useMessageHandler } from './hooks/useMessageHandler';
import { getElementStyles, updateElementStyle, updateElementContent } from './utils/iframe-utils';
import { StyleUpdateService, ComponentData as StyleComponentData } from '../style-update/index';
import { ComponentData, ComputedStyles, CustomStyles, SpacingInputs } from './types';
import { Code, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ComponentInspectorProps {
  setIsInspectMode?: React.Dispatch<React.SetStateAction<boolean>>;
  populateChatInput?: (content: string) => void;
}

export function ComponentInspector({
  setIsInspectMode,
  populateChatInput
}: ComponentInspectorProps = {}) {
  // Component selection state
  const [selectedComponent, setSelectedComponent] = useState<ComponentData | null>(null);
  const [computedStyles, setComputedStyles] = useState<ComputedStyles | null>(null);
  const [customStyles, setCustomStyles] = useState<CustomStyles>({});

  // Spacing inputs for controlled inputs
  const [spacingInputs, setSpacingInputs] = useState<SpacingInputs>({});

  // Content editing
  const [editableContent, setEditableContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');

  // UI state
  const [activeTab, setActiveTab] = useState<string>('content');
  const [applyingChanges, setApplyingChanges] = useState<boolean>(false);
  const [isStyleEdited, setIsStyleEdited] = useState<boolean>(false);
  const [isContentEdited, setIsContentEdited] = useState<boolean>(false);

  // Set up message handler
  useMessageHandler({
    setSelectedComponent,
    setComputedStyles,
    setCustomStyles,
    setSpacingInputs,
    setIsContentEdited,
    setIsStyleEdited,
    setEditableContent,
    setOriginalContent,
    setApplyingChanges
  });

  // Request element styles when a component is selected
  useEffect(() => {
    if (selectedComponent) {
      getElementStyles(selectedComponent.id);
      
      // Reset content editing state when component changes
      setIsContentEdited(false);
      
      // If there's no content or it's empty, make sure we initialize properly
      if (!selectedComponent.textContent || selectedComponent.textContent.trim() === '') {
        setEditableContent('');
        setOriginalContent('');
      }
    }
  }, [selectedComponent]);

  // Handle style property change
  const handleStyleChange = (property: string, value: string) => {
    const updatedStyles = {
      ...customStyles,
      [property]: value
    };
    
    setCustomStyles(updatedStyles);
    setIsStyleEdited(true);
    
    // Apply visual change immediately
    if (selectedComponent) {
      updateElementStyle(selectedComponent.id, updatedStyles);
    }
  };

  // Handle spacing input changes
  const handleSpacingInputChange = (
    property: string, 
    value: string, 
    bothSides = false,
    pairedProperty?: string
  ) => {
    // Add debug logging
    console.log(`Updating spacing: ${property}=${value}, bothSides=${bothSides}, paired=${pairedProperty}`);
    
    // Update the input value immediately for responsive UI
    setSpacingInputs(prev => ({
      ...prev,
      [property]: value
    }));

    // Add px unit if needed
    const valueWithUnit = value ? (value.endsWith('px') ? value : `${value}px`) : value;
    
    // Create a copy of customStyles to update
    let updatedStyles = { ...customStyles };
    
    // Always update the current property
    updatedStyles[property] = valueWithUnit;
    
    // If both sides flag is set and paired property provided, update that too
    if (bothSides && pairedProperty) {
      updatedStyles[pairedProperty] = valueWithUnit;
      
      // Also update the input display for paired property
      setSpacingInputs(prev => ({
        ...prev,
        [pairedProperty]: value
      }));
    }
    
    // Update custom styles - this should trigger isStyleEdited in the effect
    console.log('Setting customStyles to:', updatedStyles);
    setCustomStyles(updatedStyles);
    
    // Force set isStyleEdited true regardless of other checks
    setIsStyleEdited(true);
    
    // Apply visual change immediately
    if (selectedComponent) {
      updateElementStyle(selectedComponent.id, updatedStyles);
    }
  };

  // Apply style changes to the element
  const applyStyleChanges = () => {
    // Add additional debug logging
    console.log('Applying style changes, selectedComponent:', selectedComponent);
    
    if (!selectedComponent) {
      console.error('Cannot apply style changes: selectedComponent is undefined');
      setApplyingChanges(false);
      return;
    }
    
    setApplyingChanges(true);
    
    try {
      // Use direct component properties instead of parsing from selector
      const filePath = selectedComponent.path || 'src/pages/Index.tsx';
      const lineNumber = selectedComponent.line || '0';
      const fileName = selectedComponent.file || 'Index.tsx';
      
      console.log('Component info:', { filePath, lineNumber, fileName });
      
      // Adapt our ComponentData to match StyleUpdateService's expected format
      const adaptedComponent: StyleComponentData = {
        id: selectedComponent.id,
        name: selectedComponent.name || 'Component',
        path: filePath,
        line: lineNumber,
        file: fileName
      };
      
      console.log('Adapted component for StyleUpdateService:', adaptedComponent);
      
      // First apply the visual change
      updateElementStyle(selectedComponent.id, customStyles);
      
      // Then persist to file if needed
      StyleUpdateService.persistStyleChanges(adaptedComponent, customStyles)
        .then(() => {
          console.log('Style changes applied successfully');
          setIsStyleEdited(false);
          setApplyingChanges(false);
        })
        .catch(err => {
          console.error('Error saving styles:', err);
          setApplyingChanges(false);
        });
    } catch (error) {
      console.error('Error in applyStyleChanges:', error);
      setApplyingChanges(false);
    }
  };

  // Apply content changes to the element
  const applyContentChanges = (content: string) => {
    if (!selectedComponent) return;
    setApplyingChanges(true);
    
    try {
      // Use direct component properties
      const filePath = selectedComponent.path || 'src/pages/Index.tsx';
      const lineNumber = selectedComponent.line || '0';
      const fileName = selectedComponent.file || 'Index.tsx';
      
      console.log('Component info for content update:', { filePath, lineNumber, fileName });
      
      // Adapt our ComponentData to match StyleUpdateService's expected format
      const adaptedComponent: StyleComponentData = {
        id: selectedComponent.id,
        name: selectedComponent.name || 'Component',
        path: filePath,
        line: lineNumber,
        file: fileName
      };
      
      // First apply the visual change
      updateElementContent(selectedComponent.id, content);
      
      // Then persist to file if needed
      StyleUpdateService.persistContentChanges(adaptedComponent, content)
        .then(() => {
          console.log('Content changes applied successfully');
          setIsContentEdited(false);
          setApplyingChanges(false);
        })
        .catch(err => {
          console.error('Error saving content:', err);
          setApplyingChanges(false);
        });
    } catch (error) {
      console.error('Error in applyContentChanges:', error);
      setApplyingChanges(false);
    }
  };

  // Save classes to a CSS file
  const saveClassesToFile = () => {
    if (!selectedComponent) return;
    
    console.log('Saving classes to file, selectedComponent:', selectedComponent);
    
    try {
      // Set applying changes to true to show loading state
      setApplyingChanges(true);
      
      // Use direct component properties
      const filePath = selectedComponent.path || 'src/pages/Index.tsx';
      const lineNumber = selectedComponent.line || '0';
      const fileName = selectedComponent.file || 'Index.tsx';
      
      console.log('Component info for class update:', { filePath, lineNumber, fileName });
      
      // Adapt our ComponentData to match StyleUpdateService's expected type
      const adaptedComponent: StyleComponentData = {
        id: selectedComponent.id,
        name: selectedComponent.name || 'Component',
        path: filePath,
        line: lineNumber,
        file: fileName
      };
      
      // Get the className value from customStyles
      if (!customStyles.className) {
        console.error('No className found in customStyles');
        setApplyingChanges(false);
        return;
      }
      
      console.log('Saving className:', customStyles.className);
      
      // Create styles with className
      const classStyles = {
        className: customStyles.className
      };
      
      // Use StyleUpdateService to persist changes
      StyleUpdateService.persistStyleChanges(adaptedComponent, classStyles)
        .then(() => {
          console.log('Successfully saved class changes to file');
          setIsStyleEdited(false);
          setApplyingChanges(false);
        })
        .catch(err => {
          console.error('Error saving classes:', err);
          setApplyingChanges(false);
        });
    } catch (error) {
      console.error('Error in saveClassesToFile:', error);
      setApplyingChanges(false);
    }
  };

  if (!selectedComponent) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center overflow-auto bg-gradient-to-b from-transparent to-blue-50/20 dark:to-blue-950/10 p-2 sm:p-6">
        <div className="max-w-md text-center space-y-2 sm:space-y-4 py-2">
          <div className="relative mx-auto w-10 h-10 sm:w-12 sm:h-12 mb-1">
            <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-full animate-ping opacity-75" style={{ animationDuration: '3s' }}></div>
            <div className="relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-800/30">
              <Code className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            </div>
          </div>
          <h3 className="text-sm sm:text-base font-medium text-blue-700 dark:text-blue-300">UI Edit Mode</h3>
          <p className="text-[11px] sm:text-xs text-muted-foreground">
            Click any component in the preview to edit
          </p>
        </div>
      </div>
    );
  }

  // Parse selector for display
  const elementPath = selectedComponent.selector || selectedComponent.id || '';
  
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-gray-50/50 dark:bg-zinc-900/20">
      <DragStyles />
      
      {/* Component Info Header */}
      <div className="py-1.5 px-3 bg-white dark:bg-zinc-900 border-b flex-shrink-0 min-h-[40px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="font-medium text-base text-ellipsis whitespace-nowrap overflow-hidden">
              {selectedComponent?.tagName ? selectedComponent.tagName.toLowerCase() : 'Component'}
            </span>
            {selectedComponent?.className && (
              <Badge variant="outline" className="ml-1 text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50 flex-shrink-0">
                {(selectedComponent.className.trim().split(/\s+/).filter(Boolean).length)} classes
              </Badge>
            )}
          </div>
          
          {/* Ask AI Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    if (populateChatInput && selectedComponent) {
                      const componentSummary = `
\`\`\`User Selected Component
File path: ${selectedComponent.path || 'none'}
\`\`\`
                      `;
                      
                      populateChatInput(componentSummary);
                      if (setIsInspectMode) {
                        setIsInspectMode(false);
                      }
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 h-7"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span className="text-xs">Ask AI</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Ask AI to help modify this component</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate" title={elementPath}>
          {elementPath}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-2 sm:px-4 border-b bg-gray-50 dark:bg-zinc-900/50 flex-shrink-0">
          <TabsList className="mb-0 gap-1 bg-transparent h-8">   
            <TabsTrigger value="content" className="text-xs px-2 sm:px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">Content</TabsTrigger>
            <TabsTrigger value="styles" className="text-xs px-2 sm:px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">Layout & Colors</TabsTrigger>
            <TabsTrigger value="classes" className="text-xs px-2 sm:px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">Classes</TabsTrigger>
            <TabsTrigger value="info" className="text-xs px-2 sm:px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">Info</TabsTrigger>    
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto bg-white dark:bg-zinc-900/80 min-h-0">
          {/* Content Tab */}
          <TabsContent value="content" className="h-auto m-0 overflow-auto flex-1">
            <ContentTab
              selectedComponent={selectedComponent}
              computedStyles={computedStyles}
              customStyles={customStyles}
              isContentEdited={isContentEdited}
              isStyleEdited={isStyleEdited}
              applyingChanges={applyingChanges}
              editableContent={editableContent}
              originalContent={originalContent}
              setEditableContent={setEditableContent}
              setIsContentEdited={setIsContentEdited}
              setIsStyleEdited={setIsStyleEdited}
              setCustomStyles={setCustomStyles}
              applyContentChanges={applyContentChanges}
              applyStyleChanges={applyStyleChanges}
              handleStyleChange={handleStyleChange}
            />
          </TabsContent>
          
          {/* Styles Tab */}
          <TabsContent value="styles" className="h-auto m-0 overflow-auto flex-1">
            <StylesTab
              selectedComponent={selectedComponent}
              computedStyles={computedStyles}
              customStyles={customStyles}
              isStyleEdited={isStyleEdited}
              isContentEdited={isContentEdited}
              applyingChanges={applyingChanges}
              spacingInputs={spacingInputs}
              setSpacingInputs={setSpacingInputs}
              handleSpacingInputChange={handleSpacingInputChange}
              handleStyleChange={handleStyleChange}
              setIsStyleEdited={setIsStyleEdited}
              setIsContentEdited={setIsContentEdited}
              setCustomStyles={setCustomStyles}
              applyStyleChanges={applyStyleChanges}
              applyContentChanges={applyContentChanges}
            />
          </TabsContent>
          
          {/* Classes Tab */}
          <TabsContent value="classes" className="h-auto m-0 overflow-auto flex-1">
            <ClassesTab
              selectedComponent={selectedComponent}
              computedStyles={computedStyles}
              customStyles={customStyles}
              isStyleEdited={isStyleEdited}
              isContentEdited={isContentEdited}
              applyingChanges={applyingChanges}
              setIsStyleEdited={setIsStyleEdited}
              setIsContentEdited={setIsContentEdited}
              setCustomStyles={setCustomStyles}
              applyStyleChanges={applyStyleChanges}
              applyContentChanges={applyContentChanges}
              saveClassesToFile={saveClassesToFile}
            />
          </TabsContent>
          
          {/* Info Tab */}
          <TabsContent value="info" className="h-auto m-0 overflow-auto flex-1">
            <InfoTab
              selectedComponent={selectedComponent}
              computedStyles={computedStyles}
              customStyles={customStyles}
              isStyleEdited={isStyleEdited}
              isContentEdited={isContentEdited}
              applyingChanges={applyingChanges}
              setIsStyleEdited={setIsStyleEdited}
              setIsContentEdited={setIsContentEdited}
              setCustomStyles={setCustomStyles}
              applyStyleChanges={applyStyleChanges}
              applyContentChanges={applyContentChanges}
              setIsInspectMode={setIsInspectMode}
              populateChatInput={populateChatInput}
            />
          </TabsContent>
        </div>
      </Tabs>
      
      {/* Loading overlay */}
      {applyingChanges && (
        <div className="absolute inset-0 bg-black/5 dark:bg-black/20 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-800 rounded-md p-3 shadow-lg">
            <p className="text-sm">Applying changes...</p>
          </div>
        </div>
      )}
    </div>
  );
} 