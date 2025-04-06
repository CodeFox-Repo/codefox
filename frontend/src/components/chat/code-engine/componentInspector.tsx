import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getElementStyles, updateElementStyle, updateElementContent } from './iframe-click-handler';
import { StyleUpdateService } from './style-update';
import { toast } from 'sonner';
import { Code } from 'lucide-react';

// Type for component data from custom inspector
type ComponentData = {
  id: string;
  name: string;
  path: string;
  line: string;
  file: string;
  content: {
    text?: string;
    className?: string;
    placeholder?: string;
    [key: string]: any;
  };
};

// Style change type
interface StyleChanges {
  [key: string]: string;
}

// For computed styles from the browser
type ComputedStyles = {
  [key: string]: string;
};

export function ComponentInspector() {
  const [selectedComponent, setSelectedComponent] = useState<ComponentData | null>(null);
  const [activeTab, setActiveTab] = useState('info');
  const [computedStyles, setComputedStyles] = useState<ComputedStyles | null>(null);
  const [customStyles, setCustomStyles] = useState<ComputedStyles>({});
  const [editableContent, setEditableContent] = useState<string>('');
  const [isContentEdited, setIsContentEdited] = useState(false);
  const [isStyleEdited, setIsStyleEdited] = useState(false);
  const [applyingChanges, setApplyingChanges] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  
  // State for tracking raw input values before applying them
  const [spacingInputs, setSpacingInputs] = useState<{[key: string]: string}>({});
  
  // Track original content to detect changes
  const [originalContent, setOriginalContent] = useState<string>('');
  
  // Get the iframe reference from the web-view
  useEffect(() => {
    const getIframeRef = () => {
      const iframe = document.getElementById('myIframe') as HTMLIFrameElement;
      if (iframe) {
        iframeRef.current = iframe;
        console.log("Iframe reference obtained");
        
        // Try to get styles if component is selected
        if (selectedComponent) {
          console.log("Requesting styles for component:", selectedComponent.id);
          getElementStyles(iframe, selectedComponent.id);
        }
      } else {
        console.warn("Couldn't find iframe with id 'myIframe'");
        // Try again in 500ms if iframe not found
        setTimeout(getIframeRef, 500);
      }
    };
    
    getIframeRef();
  }, [selectedComponent?.id]);

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || !event.data.type) {
        console.warn("Received message with missing type:", event.data);
        return;
      }
      
      console.log("ComponentInspector received message:", event.data.type);
      
      // Handle component click data forwarded from iframe-click-handler
      if (event.data.type === 'COMPONENT_CLICK') {
        console.log("Processing component click:", event.data.componentData);
        setSelectedComponent(event.data.componentData);
        setComputedStyles(null); // Reset computed styles
        setCustomStyles({}); // Reset custom styles
        setIsContentEdited(false);
        setIsStyleEdited(false);
        
        // Get latest content and store it as the original content too
        if (event.data.componentData.content.text) {
          setEditableContent(event.data.componentData.content.text);
          setOriginalContent(event.data.componentData.content.text);
        } else {
          setEditableContent('');
          setOriginalContent('');
        }
      } else if (event.data.type === 'ELEMENT_STYLES') {
        console.log("Processing element styles response:", event.data.payload);
        if (event.data.payload && event.data.payload.success) {
          console.log("Received computed styles:", event.data.payload.styles);
          setComputedStyles(event.data.payload.styles);
        } else {
          console.error("Error fetching styles:", event.data.payload?.error || "Unknown error");
        }
      } else if (event.data.type === 'ELEMENT_STYLE_UPDATED') {
        console.log("Processing style update response:", event.data.payload);
        setApplyingChanges(false);
        
        if (event.data.payload && event.data.payload.success) {
          // Update the selected component with new data
          setSelectedComponent(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              ...event.data.payload.elementData,
            };
          });
          
          // Display confirmation
          console.log('Style updated successfully', event.data.payload.appliedStyles);
          setIsStyleEdited(false);
        } else {
          console.error("Style update failed:", event.data.payload?.error || "Unknown error");
          alert(`Failed to update style: ${event.data.payload?.error || "Unknown error"}`);
        }
      } else if (event.data.type === 'ELEMENT_CONTENT_UPDATED') {
        console.log("Processing content update response:", event.data.payload);
        setApplyingChanges(false);
        
        if (event.data.payload && event.data.payload.success) {
          // Update the selected component with new data
          setSelectedComponent(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              ...event.data.payload.elementData,
              content: {
                ...prev.content,
                text: event.data.payload.appliedContent,
              },
            };
          });
          
          // Display confirmation
          console.log('Content updated successfully');
          setIsContentEdited(false);
        } else {
          console.error("Content update failed:", event.data.payload?.error || "Unknown error");
          alert(`Failed to update content: ${event.data.payload?.error || "Unknown error"}`);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  // Apply style changes to the DOM only (visual update)
  const applyStyleChangesVisual = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    
    if (!selectedComponent || !iframeRef.current) {
      console.error('Cannot apply style: component or iframe not available');
      return;
    }
    
    const stylesToApply = customStyles;
    
    if (Object.keys(stylesToApply).length === 0) {
      console.warn('No style changes to apply');
      return;
    }
    
    console.log('Applying visual style changes:', stylesToApply);
    
    try {
      // Apply changes to the DOM for immediate visual feedback
      updateElementStyle(iframeRef.current, selectedComponent.id, stylesToApply);
    } catch (error) {
      console.error('Error applying visual style update:', error);
    }
  };

  // Save style changes to the source file
  const saveStylesToFile = async () => {
    if (!selectedComponent) {
      toast.error("No component selected");
      return;
    }
    
    if (Object.keys(customStyles).length === 0) {
      toast.error("No style changes to save");
      return;
    }
    
    setApplyingChanges(true);
    
    try {
      // Persist the changes to the source file
      const success = await StyleUpdateService.persistStyleChanges(
        selectedComponent, 
        customStyles
      );
      
      if (success) {
        toast.success("Style changes saved to source file");
        // Clear style changes as they've been applied
        setIsStyleEdited(false);
      } else {
        toast.error("Changes are visible but couldn't be saved to source file");
      }
    } catch (error) {
      console.error('Error saving styles to file:', error);
      toast.error("Error saving styles to file");
    } finally {
      setApplyingChanges(false);
    }
  };

  // Handle style property change
  const handleStyleChange = (property: string, value: string) => {
    const updatedStyles = {
      ...customStyles,
      [property]: value,
    };
    
    setCustomStyles(updatedStyles);
    setIsStyleEdited(true);
    
    // Apply visual change immediately without needing a button
    if (selectedComponent && iframeRef.current) {
      try {
        updateElementStyle(iframeRef.current, selectedComponent.id, updatedStyles);
      } catch (error) {
        console.error('Error applying visual style update:', error);
      }
    }
  };

  // Apply content changes visually (DOM only)
  const applyContentChangesVisual = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    
    if (!selectedComponent || !iframeRef.current || !isContentEdited) {
      return;
    }
    
    try {
      // Apply changes to the DOM for immediate visual feedback
      updateElementContent(iframeRef.current, selectedComponent.id, editableContent);
    } catch (error) {
      console.error('Error applying visual content update:', error);
    }
  };

  // Handle content change with improved change detection
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setEditableContent(newContent);
    
    // Force change state to true whenever user types something
    setIsContentEdited(true);
    
    // More advanced change detection for debugging
    const hasChanged = newContent !== originalContent;
    console.log('Content change detected:', {
      hasChanged,
      newContentLength: newContent.length,
      originalContentLength: originalContent.length,
      matching: newContent === originalContent,
      newContent: newContent.substring(0, 50),
      originalContent: originalContent.substring(0, 50)
    });
    
    // Apply content changes with slight delay to avoid disrupting typing
    const timeoutId = setTimeout(() => {
      if (selectedComponent && iframeRef.current) {
        try {
          updateElementContent(iframeRef.current, selectedComponent.id, newContent);
        } catch (error) {
          console.error('Error applying visual content update:', error);
        }
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  };

  // Save content changes to the source file with improved validation
  const saveContentToFile = async () => {
    if (!selectedComponent) {
      toast.error("No component selected");
      return;
    }
    
    // Skip the content change check - if user wants to save, let them save
    // This ensures the button works even if our change detection fails
    
    setApplyingChanges(true);
    
    try {
      // Persist the changes to the source file
      const success = await StyleUpdateService.persistContentChanges(
        selectedComponent, 
        editableContent
      );
      
      if (success) {
        toast.success("Content changes saved to source file");
        setIsContentEdited(false);
        setOriginalContent(editableContent); // Update the reference content
      } else {
        toast.error("Changes are visible but couldn't be saved to source file");
      }
    } catch (error) {
      console.error('Error saving content to file:', error);
      toast.error("Error saving content to file");
    } finally {
      setApplyingChanges(false);
    }
  };

  // Handle spacing input change with debounce
  const handleSpacingInputChange = (property: string, value: string, applyToBoth: boolean = false, pairedProperty?: string) => {
    // Store the raw input value for display purposes
    setSpacingInputs(prev => ({
      ...prev,
      [property]: value
    }));
    
    // Don't immediately apply px suffix - wait until user finishes typing
    const numericValue = value.replace(/[^\d]/g, '');
    
    // Debounce the actual style change to avoid updating while user is typing
    clearTimeout((window as any).spacingDebounceTimer);
    (window as any).spacingDebounceTimer = setTimeout(() => {
      // Only apply the style if we have a numeric value
      if (numericValue) {
        const valueWithUnit = `${numericValue}px`;
        handleStyleChange(property, valueWithUnit);
        
        // If this is a paired property (like left/right padding), update both
        if (applyToBoth && pairedProperty) {
          handleStyleChange(pairedProperty, valueWithUnit);
          setSpacingInputs(prev => ({
            ...prev,
            [pairedProperty]: numericValue
          }));
        }
      }
    }, 500);
  };
  
  // Render spacing input with debounced update
  const renderSpacingInput = (property: string, label: string, pairedProperty?: string) => {
    // Determine what value to show in the input field
    const displayValue = 
      // First show what the user is actively typing
      spacingInputs[property] !== undefined ? spacingInputs[property] : 
      // Then show what's in the style application queue
      customStyles[property] ? customStyles[property].replace('px', '') :
      // Finally fall back to computed styles if available
      computedStyles?.[property] ? computedStyles[property].replace('px', '') : '';
    
    return (
      <div>
        <div className="flex justify-between mb-1.5">
          <Label htmlFor={`${property}-input`} className="text-xs flex items-center gap-1">
            <span>{label}</span>
            {displayValue && (
              <code className="text-[10px] bg-gray-100 dark:bg-zinc-800 px-1 rounded text-blue-500">
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
                  handleSpacingInputChange(property, newVal, !!pairedProperty, pairedProperty);
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
                handleSpacingInputChange(property, newVal, !!pairedProperty, pairedProperty);
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
                handleSpacingInputChange(property, e.target.value, !!pairedProperty, pairedProperty);
              }}
              className="h-7 text-xs flex-1"
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
                    handleStyleChange(side, `${displayValue}px`);
                    setSpacingInputs(prev => ({
                      ...prev,
                      [side]: displayValue
                    }));
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
          
          {/* Tips (hidden in very small heights) */}
          <div className="text-[10px] sm:text-xs text-muted-foreground border rounded-md p-1.5 sm:p-3 bg-white/80 dark:bg-zinc-900/80 shadow-sm hidden sm:block">
            <p className="font-medium mb-1 text-blue-600 dark:text-blue-400 text-[10px] sm:text-xs">Tips:</p>
            <ul className="space-y-0.5 sm:space-y-1 list-disc list-inside text-left text-[10px] sm:text-xs">
              <li>Select elements to edit</li>
              <li>Modify styles and content</li>
              <li>Save changes to files</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Parse ID parts (filepath:line:col) for display
  const idParts = selectedComponent.id.split(':');
  const filePath = idParts[0] || selectedComponent.path;
  const lineNumber = idParts.length > 1 ? idParts[1] : selectedComponent.line;
  const colNumber = idParts.length > 2 ? idParts[2] : '0';
  
  // Get filename from path
  const fileName = selectedComponent.file || filePath.split('/').pop() || 'Unknown';

  // Parse classes for better display
  const classes = selectedComponent.content.className?.split(' ').filter(Boolean) || [];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-gray-50/50 dark:bg-zinc-900/20">
      <div className="py-1.5 px-3 bg-white dark:bg-zinc-900 border-b flex-shrink-0 min-h-[40px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="font-medium text-base text-ellipsis whitespace-nowrap overflow-hidden">{selectedComponent.name}</span>
            <Badge variant="outline" className="ml-1 text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50 flex-shrink-0">
              {lineNumber}:{colNumber}
            </Badge>
          </div>
          <Badge variant="secondary" className="text-xs truncate max-w-[40%] flex-shrink-0" title={fileName}>
            {fileName}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate" title={selectedComponent.path || filePath}>
          {selectedComponent.path || filePath}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-2 sm:px-4 border-b bg-gray-50 dark:bg-zinc-900/50 flex-shrink-0">
          <TabsList className="mb-0 gap-1 bg-transparent h-8">
            <TabsTrigger value="info" className="text-xs px-2 sm:px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">Info</TabsTrigger>
            <TabsTrigger value="styles" className="text-xs px-2 sm:px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">Styles</TabsTrigger>
            <TabsTrigger value="classes" className="text-xs px-2 sm:px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">Classes</TabsTrigger>
            <TabsTrigger value="content" className="text-xs px-2 sm:px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">Content</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto bg-white dark:bg-zinc-900/80 min-h-0">
          {/* Info Tab */}
          <TabsContent value="info" className="p-3 sm:p-5 m-0 h-auto overflow-visible">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-muted-foreground">Component</h4>
                  <p className="text-sm font-medium bg-gray-50 dark:bg-zinc-800 p-2 rounded">{selectedComponent.name}</p>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-muted-foreground">File</h4>
                  <p className="text-sm font-medium bg-gray-50 dark:bg-zinc-800 p-2 rounded">{fileName}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground">Location</h4>
                <p className="text-sm font-medium bg-gray-50 dark:bg-zinc-800 p-2 rounded">Line {lineNumber}, Column {colNumber}</p>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground">Full Path</h4>
                <p className="text-sm break-all bg-gray-50 dark:bg-zinc-800 p-2 rounded font-mono text-xs">{selectedComponent.path || filePath}</p>
              </div>
            </div>
          </TabsContent>

          {/* Styles Tab */}
          <TabsContent value="styles" className="p-3 sm:p-5 m-0 h-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b mb-4">
              <h3 className="text-sm font-medium flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Style Properties
              </h3>
              <Button 
                size="sm" 
                className="bg-blue-500 hover:bg-blue-600 text-white mt-2 sm:mt-0"
                onClick={saveStylesToFile}
                disabled={!selectedComponent || !iframeRef.current || applyingChanges || Object.keys(customStyles).length === 0}
              >
                {applyingChanges ? 
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-1"></div>
                    <span>Saving...</span>
                  </div> : 
                  'Save to File'
                }
              </Button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); saveStylesToFile(); }} className="space-y-4 sm:space-y-6">
              {/* Colors Section */}
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-md p-3 sm:p-4">
                <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  Colors
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="text-color" className="text-xs flex items-center justify-between">
                      <span>Text Color</span>
                      <code className="text-xs bg-gray-100 dark:bg-zinc-900 px-1 rounded">
                        {customStyles.color || computedStyles?.color || '#000000'}
                      </code>
                    </Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="text-color"
                        name="text-color"
                        type="color"
                        value={customStyles.color || (computedStyles?.color || '#000000')}
                        onChange={(e) => handleStyleChange('color', e.target.value)}
                        className="w-10 h-10 p-1 rounded-full overflow-hidden"
                      />
                      <Input
                        type="text"
                        value={customStyles.color || (computedStyles?.color || '')}
                        onChange={(e) => handleStyleChange('color', e.target.value)}
                        className="flex-1 h-8 text-xs"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bg-color" className="text-xs flex items-center justify-between">
                      <span>Background</span>
                      <code className="text-xs bg-gray-100 dark:bg-zinc-900 px-1 rounded">
                        {customStyles.backgroundColor || computedStyles?.backgroundColor || '#ffffff'}
                      </code>
                    </Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="bg-color"
                        name="bg-color"
                        type="color"
                        value={customStyles.backgroundColor || (computedStyles?.backgroundColor || '#ffffff')}
                        onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                        className="w-10 h-10 p-1 rounded-full overflow-hidden"
                      />
                      <Input
                        type="text"
                        value={customStyles.backgroundColor || (computedStyles?.backgroundColor || '')}
                        onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                        className="flex-1 h-8 text-xs"
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography Section */}
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-md p-3 sm:p-4">
                <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  Typography
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label htmlFor="font-size" className="text-xs mb-1.5 flex items-center justify-between">
                      <span>Font Size</span>
                      <code className="text-xs bg-gray-100 dark:bg-zinc-900 px-1 rounded">
                        {customStyles.fontSize || computedStyles?.fontSize || ''}
                      </code>
                    </Label>
                    <Input
                      id="font-size"
                      name="font-size"
                      value={customStyles.fontSize || computedStyles?.fontSize || ''}
                      onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                      className="h-8 text-xs"
                      placeholder={computedStyles?.fontSize || '16px'}
                    />
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
                      onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                      className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
                    >
                      <option value="">Default</option>
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                      <option value="100">100</option>
                      <option value="200">200</option>
                      <option value="300">300</option>
                      <option value="400">400</option>
                      <option value="500">500</option>
                      <option value="600">600</option>
                      <option value="700">700</option>
                      <option value="800">800</option>
                      <option value="900">900</option>
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
                          handleStyleChange('textAlign', align);
                        }}
                      >
                        {align}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Spacing Section */}
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-md p-3 sm:p-4">
                <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  Spacing
                </h4>
                
                {/* Padding controls */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-medium">Padding</h5>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          // Reset all padding to 0
                          handleStyleChange('paddingLeft', '0px');
                          handleStyleChange('paddingRight', '0px');
                          handleStyleChange('paddingTop', '0px');
                          handleStyleChange('paddingBottom', '0px');
                          
                          // Also reset the input states
                          setSpacingInputs(prev => ({
                            ...prev,
                            paddingLeft: '0',
                            paddingRight: '0',
                            paddingTop: '0',
                            paddingBottom: '0'
                          }));
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-zinc-900 p-3 rounded-md border border-gray-100 dark:border-zinc-800">
                    {/* Horizontal padding */}
                    {renderSpacingInput('paddingLeft', 'Horizontal', 'paddingRight')}
                    
                    {/* Vertical padding */}
                    {renderSpacingInput('paddingTop', 'Vertical', 'paddingBottom')}
                  </div>
                </div>
                
                {/* Margin controls */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-medium">Margin</h5>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          // Reset all margins to 0
                          handleStyleChange('marginLeft', '0px');
                          handleStyleChange('marginRight', '0px');
                          handleStyleChange('marginTop', '0px');
                          handleStyleChange('marginBottom', '0px');
                          
                          // Also reset the input states
                          setSpacingInputs(prev => ({
                            ...prev,
                            marginLeft: '0',
                            marginRight: '0',
                            marginTop: '0',
                            marginBottom: '0'
                          }));
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-zinc-900 p-3 rounded-md border border-gray-100 dark:border-zinc-800">
                    {/* Horizontal margin */}
                    {renderSpacingInput('marginLeft', 'Horizontal', 'marginRight')}
                    
                    {/* Vertical margin */}
                    {renderSpacingInput('marginTop', 'Vertical', 'marginBottom')}
                  </div>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* Classes Tab */}
          <TabsContent value="classes" className="p-3 sm:p-5 m-0 h-auto">
            <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 sm:p-4 rounded-md">
              <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Applied Classes
              </h4>
              {classes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {classes.map((cls, i) => (
                    <Badge key={i} variant="secondary" className="font-mono text-xs py-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700">
                      {cls}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-md border border-gray-100 dark:border-zinc-800">
                  <p className="text-sm text-muted-foreground">No classes applied to this component</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="p-3 sm:p-5 m-0 h-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b mb-4">
              <h3 className="text-sm font-medium flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Text Content
              </h3>
              <Button 
                size="sm" 
                className="bg-blue-500 hover:bg-blue-600 text-white mt-2 sm:mt-0"
                onClick={saveContentToFile}
                disabled={!selectedComponent || !iframeRef.current || applyingChanges || editableContent.trim() === ''}
              >
                {applyingChanges ? 
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-1"></div>
                    <span>Saving...</span>
                  </div> : 
                  'Save to File'
                }
              </Button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); saveContentToFile(); }}>
              <div className="space-y-2 mb-4">
                <Label htmlFor="component-content" className="text-xs">Edit Text</Label>
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-md p-1">
                  <Textarea 
                    id="component-content"
                    name="component-content"
                    value={editableContent}
                    onChange={handleContentChange}
                    className="min-h-[120px] sm:min-h-[150px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="Edit component content..."
                  />
                </div>
                {isContentEdited && (
                  <p className="text-xs text-blue-500 italic flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Content modified - click Save to apply changes to the source file
                  </p>
                )}
              </div>
            </form>
            
            {selectedComponent.content.placeholder && (
              <div className="mt-4 pt-3 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Placeholder Text</h4>
                <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-md border border-gray-200 dark:border-zinc-700">
                  <p className="text-sm font-mono">{selectedComponent.content.placeholder}</p>
                </div>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}