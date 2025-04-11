import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, RotateCcw } from 'lucide-react';
import { ContentTabProps } from '../types';
import { TypographyControls } from '../components/TypographyControls';
import { updateElementContent } from '../utils/iframe-utils';

/**
 * Content tab - Displays and manages text content for the selected component
 */
export const ContentTab: React.FC<ContentTabProps> = ({
  selectedComponent,
  customStyles,
  computedStyles,
  isContentEdited,
  applyingChanges,
  editableContent,
  originalContent,
  setEditableContent,
  setIsContentEdited,
  applyContentChanges,
  handleStyleChange
}) => {
  // Check if content has changed from original
  const hasContentChanged = editableContent !== originalContent;
  // Either the tag is text-editable or it actually has text content
  const hasTextContent = Boolean(originalContent.trim());
  
  // Reset content to original
  const resetContent = () => {
    setEditableContent(originalContent);
    setIsContentEdited(false);
    
    // Reset visual display when resetting content
    if (selectedComponent) {
      updateElementContent(selectedComponent.id, originalContent);
    }
  };
  
  // Apply content changes
  const handleContentSave = () => {
    if (!selectedComponent) {
      console.error('No component selected for content save');
      return;
    }

    console.log('Saving content for component:', {
      id: selectedComponent.id,
      selector: selectedComponent.selector,
      tagName: selectedComponent.tagName,
      content: editableContent.substring(0, 50) + (editableContent.length > 50 ? '...' : '')
    });
    
    applyContentChanges(editableContent);
  };
  
  // Handle content changes with real-time preview updates
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setEditableContent(newContent);
    setIsContentEdited(newContent !== originalContent);
    
    // Apply visual changes immediately
    if (selectedComponent) {
      updateElementContent(selectedComponent.id, newContent);
    }
  };
  
  if (!selectedComponent) {
    return (
      <div className="p-3 sm:p-5 m-0 flex flex-col items-center justify-center h-full text-center">
        <div className="text-muted-foreground">
          <p>No component selected</p>
          <p className="text-xs mt-1">Click an element to edit its content</p>
        </div>
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-auto overflow-auto">
      <div className="p-3 sm:p-5 m-0">
        {/* Header with content type */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-sm font-semibold">Text Content</h3>
            <p className="text-xs text-muted-foreground">Edit the component text</p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={resetContent}
              disabled={!hasContentChanged || applyingChanges}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
            <Button
              variant="default"
              size="sm"
              className="text-xs h-8"
              onClick={handleContentSave}
              disabled={!hasContentChanged || applyingChanges}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Content
            </Button>
          </div>
        </div>
        
        {/* Content editor */}
        <div className="mb-4">
          {hasTextContent ? (
            <Textarea
              value={editableContent}
              onChange={handleContentChange}
              placeholder="Enter content text..."
              className="min-h-[120px] text-sm font-mono"
              disabled={applyingChanges}
            />
          ) : (
            <div className="border rounded-md p-4 bg-gray-50 dark:bg-zinc-900/50 text-center">
              <p className="text-muted-foreground text-sm">This component doesn't have editable text content.</p>
              <p className="text-xs text-muted-foreground mt-1">You can still edit styles and classes for this element.</p>
            </div>
          )}
        </div>
        
        {/* Typography section */}
        <TypographyControls 
          customStyles={customStyles}
          computedStyles={computedStyles}
          onChange={handleStyleChange}
        />
      </div>
    </ScrollArea>
  );
}; 