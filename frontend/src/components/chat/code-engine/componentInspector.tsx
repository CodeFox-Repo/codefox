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
import { StyleUpdateService } from './styleUpdateService';
import { toast } from 'sonner';

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
          <Label htmlFor={`${property}-input`} className="text-xs">{label}</Label>
          <div className="flex space-x-2">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="h-4 w-4" 
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
              variant="ghost" 
              size="icon" 
              className="h-4 w-4" 
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
        <div className="flex items-center gap-2">
          <Input
            id={`${property}-input`}
            name={property}
            type="text"
            value={displayValue}
            onChange={(e) => {
              handleSpacingInputChange(property, e.target.value, !!pairedProperty, pairedProperty);
            }}
            className="h-7 text-xs"
          />
        </div>
      </div>
    );
  };

  if (!selectedComponent) {
    return (
      <Card className="w-full h-full flex items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">
          Click on any component in the preview to inspect it
        </p>
      </Card>
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
    <Card className="w-full h-full flex flex-col overflow-hidden">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            <span>{selectedComponent.name}</span>
            <Badge variant="outline" className="ml-2 text-xs">
              {lineNumber}:{colNumber}
            </Badge>
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {selectedComponent.path || filePath}
        </p>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 border-b">
          <TabsList className="mb-0">
            <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
            <TabsTrigger value="styles" className="text-xs">Styles</TabsTrigger>
            <TabsTrigger value="classes" className="text-xs">Classes</TabsTrigger>
              <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {/* Info Tab */}
          <TabsContent value="info" className="p-4 m-0">
            <div className="space-y-2">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">Component</h4>
                <p className="text-sm">{selectedComponent.name}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">File</h4>
                <p className="text-sm">{fileName}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">Location</h4>
                <p className="text-sm">Line {lineNumber}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">Full Path</h4>
                <p className="text-sm break-all">{selectedComponent.path || filePath}</p>
              </div>
            </div>
          </TabsContent>

          {/* Styles Tab */}
          <TabsContent value="styles" className="p-4 m-0">
            <div className="flex justify-between pb-3">
              <h3 className="text-sm font-medium">Style Properties</h3>
              <Button 
                size="sm" 
                onClick={saveStylesToFile}
                disabled={!selectedComponent || !iframeRef.current || applyingChanges || Object.keys(customStyles).length === 0}
              >
                {applyingChanges ? 'Saving...' : 'Save to File'}
              </Button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); saveStylesToFile(); }} className="space-y-6">
              {/* Colors Section */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-3">Colors</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="text-color">Text</Label>
                    <Input
                      id="text-color"
                      name="text-color"
                      type="color"
                      value={customStyles.color || (computedStyles?.color || '#000000')}
                      onChange={(e) => handleStyleChange('color', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bg-color">Background</Label>
                    <Input
                      id="bg-color"
                      name="bg-color"
                      type="color"
                      value={customStyles.backgroundColor || (computedStyles?.backgroundColor || '#ffffff')}
                      onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Typography Section */}
              <div>
                <h4 className="text-xs font-semibold border-b pb-1 mb-3">Typography</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label htmlFor="font-size" className="text-xs mb-1.5 block">Font Size</Label>
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
                    <Label htmlFor="font-weight" className="text-xs mb-1.5 block">Font Weight</Label>
                    <Input
                      id="font-weight"
                      name="font-weight"
                      value={customStyles.fontWeight || computedStyles?.fontWeight || ''}
                      onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                      className="h-8 text-xs"
                      placeholder={computedStyles?.fontWeight || 'normal'}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="text-align" className="text-xs mb-1.5 block">Text Align</Label>
                  <div className="flex gap-2">
                    {['left', 'center', 'right', 'justify'].map(align => (
                      <Button
                        key={align}
                        size="sm"
                        variant={(customStyles.textAlign || computedStyles?.textAlign) === align ? "default" : "outline"}
                        className="flex-1 h-7 text-xs"
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
              <div>
                <h4 className="text-xs font-semibold border-b pb-1 mb-3">Spacing</h4>
                
                {/* Padding controls */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-medium">Padding</h5>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
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
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
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
          <TabsContent value="classes" className="p-4 m-0">
            {classes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {classes.map((cls, i) => (
                  <Badge key={i} variant="secondary" className="font-mono text-xs">
                    {cls}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No classes applied</p>
            )}
          </TabsContent>

          {/* Content Tab */}
            <TabsContent value="content" className="p-4 m-0">
            <div className="flex justify-between pb-3">
              <h3 className="text-sm font-medium">Text Content</h3>
              <Button 
                size="sm" 
                onClick={saveContentToFile}
                disabled={!selectedComponent || !iframeRef.current || applyingChanges || editableContent.trim() === ''}
              >
                {applyingChanges ? 'Saving...' : 'Save to File'}
              </Button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); saveContentToFile(); }}>
              <Textarea 
                id="component-content"
                name="component-content"
                value={editableContent}
                onChange={handleContentChange}
                className="min-h-[150px]"
                placeholder="Edit component content..."
              />
            </form>
            
            {selectedComponent.content.placeholder && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">Placeholder</h4>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">{selectedComponent.content.placeholder}</p>
                </div>
              </div>
            )}
            </TabsContent>
        </ScrollArea>
      </Tabs>
    </Card>
  );
}