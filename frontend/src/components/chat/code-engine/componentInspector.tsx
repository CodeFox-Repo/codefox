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

// Type for computed styles
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
        
        // Get latest content
        if (event.data.componentData.content.text) {
          setEditableContent(event.data.componentData.content.text);
        } else {
          setEditableContent('');
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
  
  // Handle custom style changes
  const handleStyleChange = (property: string, value: string) => {
    setCustomStyles(prev => ({
      ...prev,
      [property]: value,
    }));
    setIsStyleEdited(true);
  };
  
  // Apply custom styles
  const applyStyles = (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    
    if (!selectedComponent || !iframeRef.current) {
      console.error('Cannot apply styles: component or iframe not available', {
        hasSelectedComponent: !!selectedComponent,
        hasIframe: !!iframeRef.current
      });
      alert('Cannot apply styles: component or iframe not available');
      return;
    }
    
    // Filter out empty values
    const stylesToApply = Object.entries(customStyles)
      .filter(([_, value]) => value.trim() !== '')
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
    
    if (Object.keys(stylesToApply).length === 0) {
      console.warn('No styles to apply');
      alert('No styles to apply');
      return;
    }
    
    console.log('Applying styles:', stylesToApply);
    setApplyingChanges(true);
    
    try {
      updateElementStyle(iframeRef.current, selectedComponent.id, stylesToApply);
    } catch (error) {
      setApplyingChanges(false);
      console.error('Error applying styles:', error);
      alert('Failed to apply styles. See console for details.');
    }
  };
  
  // Apply content changes
  const applyContentChanges = (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    
    if (!selectedComponent || !iframeRef.current) {
      console.error('Cannot apply content: component or iframe not available', {
        hasSelectedComponent: !!selectedComponent,
        hasIframe: !!iframeRef.current
      });
      alert('Cannot apply content: component or iframe not available');
      return;
    }
    
    if (!isContentEdited) {
      console.warn('No content changes to apply');
      alert('No content changes to apply');
      return;
    }
    
    console.log('Applying content changes:', editableContent);
    setApplyingChanges(true);
    
    try {
      updateElementContent(iframeRef.current, selectedComponent.id, editableContent);
    } catch (error) {
      setApplyingChanges(false);
      console.error('Error applying content:', error);
      alert('Failed to apply content. See console for details.');
    }
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
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">Edit Styles</h4>
                {isStyleEdited && (
                  <Button 
                    size="sm" 
                    onClick={applyStyles}
                    disabled={!selectedComponent || !iframeRef.current || applyingChanges}
                  >
                    {applyingChanges ? 'Applying...' : 'Apply Changes'}
                  </Button>
                )}
              </div>
              
              <form onSubmit={applyStyles} className="space-y-6">
                {/* Colors Section */}
                <div>
                  <h4 className="text-xs font-semibold border-b pb-1 mb-3">Colors</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="text-color" className="text-xs mb-1.5 block">Text Color</Label>
                      <div className="flex gap-2">
                        <input 
                          type="color"
                          id="text-color-picker" 
                          name="text-color-picker"
                          className="w-8 h-8 rounded cursor-pointer"
                          value={customStyles.color || computedStyles?.color || '#000000'}
                          onChange={(e) => handleStyleChange('color', e.target.value)}
                        />
                        <Input
                          id="text-color"
                          name="text-color"
                          value={customStyles.color || computedStyles?.color || ''}
                          onChange={(e) => handleStyleChange('color', e.target.value)}
                          className="h-8 text-xs flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bg-color" className="text-xs mb-1.5 block">Background</Label>
                      <div className="flex gap-2">
                        <input 
                          type="color"
                          id="bg-color-picker"
                          name="bg-color-picker"
                          className="w-8 h-8 rounded cursor-pointer"
                          value={customStyles.backgroundColor || computedStyles?.backgroundColor || '#ffffff'}
                          onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                        />
                        <Input
                          id="bg-color"
                          name="bg-color"
                          value={customStyles.backgroundColor || computedStyles?.backgroundColor || ''}
                          onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                          className="h-8 text-xs flex-1"
                        />
                      </div>
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
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <Label htmlFor="padding-x" className="text-xs">Horizontal</Label>
                          <div className="flex space-x-2">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-4 w-4" 
                              onClick={() => {
                                const currentVal = parseInt(customStyles.paddingLeft || "0");
                                if (currentVal > 0) {
                                  const newVal = `${currentVal - 1}px`;
                                  handleStyleChange('paddingLeft', newVal);
                                  handleStyleChange('paddingRight', newVal);
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
                              onClick={() => {
                                const currentVal = parseInt(customStyles.paddingLeft || "0");
                                const newVal = `${currentVal + 1}px`;
                                handleStyleChange('paddingLeft', newVal);
                                handleStyleChange('paddingRight', newVal);
                              }}
                            >
                              <span className="text-xs">+</span>
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id="padding-x"
                            name="padding-x"
                            type="text"
                            value={customStyles.paddingLeft || computedStyles?.paddingLeft || ''}
                            onChange={(e) => {
                              const value = e.target.value.includes('px') ? e.target.value : `${e.target.value}px`;
                              handleStyleChange('paddingLeft', value);
                              handleStyleChange('paddingRight', value);
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      
                      {/* Vertical padding */}
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <Label htmlFor="padding-y" className="text-xs">Vertical</Label>
                          <div className="flex space-x-2">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-4 w-4" 
                              onClick={() => {
                                const currentVal = parseInt(customStyles.paddingTop || "0");
                                if (currentVal > 0) {
                                  const newVal = `${currentVal - 1}px`;
                                  handleStyleChange('paddingTop', newVal);
                                  handleStyleChange('paddingBottom', newVal);
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
                              onClick={() => {
                                const currentVal = parseInt(customStyles.paddingTop || "0");
                                const newVal = `${currentVal + 1}px`;
                                handleStyleChange('paddingTop', newVal);
                                handleStyleChange('paddingBottom', newVal);
                              }}
                            >
                              <span className="text-xs">+</span>
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id="padding-y"
                            name="padding-y"
                            type="text"
                            value={customStyles.paddingTop || computedStyles?.paddingTop || ''}
                            onChange={(e) => {
                              const value = e.target.value.includes('px') ? e.target.value : `${e.target.value}px`;
                              handleStyleChange('paddingTop', value);
                              handleStyleChange('paddingBottom', value);
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Margin controls */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-medium">Margin</h5>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* Horizontal margin */}
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <Label htmlFor="margin-x" className="text-xs">Horizontal</Label>
                          <div className="flex space-x-2">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-4 w-4" 
                              onClick={() => {
                                const currentVal = parseInt(customStyles.marginLeft || "0");
                                if (currentVal > 0) {
                                  const newVal = `${currentVal - 1}px`;
                                  handleStyleChange('marginLeft', newVal);
                                  handleStyleChange('marginRight', newVal);
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
                              onClick={() => {
                                const currentVal = parseInt(customStyles.marginLeft || "0");
                                const newVal = `${currentVal + 1}px`;
                                handleStyleChange('marginLeft', newVal);
                                handleStyleChange('marginRight', newVal);
                              }}
                            >
                              <span className="text-xs">+</span>
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id="margin-x"
                            name="margin-x"
                            type="text"
                            value={customStyles.marginLeft || computedStyles?.marginLeft || ''}
                            onChange={(e) => {
                              const value = e.target.value.includes('px') ? e.target.value : `${e.target.value}px`;
                              handleStyleChange('marginLeft', value);
                              handleStyleChange('marginRight', value);
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      
                      {/* Vertical margin */}
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <Label htmlFor="margin-y" className="text-xs">Vertical</Label>
                          <div className="flex space-x-2">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-4 w-4" 
                              onClick={() => {
                                const currentVal = parseInt(customStyles.marginTop || "0");
                                if (currentVal > 0) {
                                  const newVal = `${currentVal - 1}px`;
                                  handleStyleChange('marginTop', newVal);
                                  handleStyleChange('marginBottom', newVal);
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
                              onClick={() => {
                                const currentVal = parseInt(customStyles.marginTop || "0");
                                const newVal = `${currentVal + 1}px`;
                                handleStyleChange('marginTop', newVal);
                                handleStyleChange('marginBottom', newVal);
                              }}
                            >
                              <span className="text-xs">+</span>
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id="margin-y"
                            name="margin-y"
                            type="text"
                            value={customStyles.marginTop || computedStyles?.marginTop || ''}
                            onChange={(e) => {
                              const value = e.target.value.includes('px') ? e.target.value : `${e.target.value}px`;
                              handleStyleChange('marginTop', value);
                              handleStyleChange('marginBottom', value);
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Hidden submit button for form submission */}
                <button type="submit" className="hidden">Submit</button>
              </form>
            </div>
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Edit Content</h4>
                {isContentEdited && (
                  <Button 
                    size="sm" 
                    onClick={applyContentChanges}
                    disabled={!selectedComponent || !iframeRef.current || applyingChanges}
                  >
                    {applyingChanges ? 'Applying...' : 'Apply Changes'}
                  </Button>
                )}
              </div>
              
              <form onSubmit={applyContentChanges}>
                <Textarea 
                  id="component-content"
                  name="component-content"
                  value={editableContent}
                  onChange={(e) => {
                    setEditableContent(e.target.value);
                    setIsContentEdited(true);
                  }}
                  className="min-h-[150px]"
                  placeholder="Edit component content..."
                />
                
                {/* Hidden submit button for form submission */}
                <button type="submit" className="hidden">Submit</button>
              </form>
              
              {selectedComponent.content.placeholder && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">Placeholder</h4>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm">{selectedComponent.content.placeholder}</p>
                  </div>
                </div>
              )}
              </div>
            </TabsContent>
        </ScrollArea>
      </Tabs>
    </Card>
  );
}