import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InfoTabProps } from '../types';

/**
 * Info tab - Displays information about the selected component
 */
export const InfoTab: React.FC<InfoTabProps> = ({ selectedComponent }) => {
  if (!selectedComponent) return null;
  
  // Extract details - with safe defaults
  const { 
    tagName = 'div', 
    className = '', 
    selector = '', 
    id = '', 
    attributes = {}, 
    rect = { width: 0, height: 0, top: 0, left: 0 } 
  } = selectedComponent;
  
  return (
    <ScrollArea className="h-auto overflow-auto">
      <div className="space-y-4 p-3 sm:p-5 m-0">
        {/* Component Type */}
        <div>
          <h3 className="text-sm font-semibold flex items-center">
            <Code className="w-4 h-4 mr-2 text-blue-500" />
            Component Type
          </h3>
          <Card className="mt-2 overflow-hidden">
            <CardContent className="p-3 text-sm">
              <Badge variant="outline" className="px-2 py-0.5 text-xs font-mono bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                {tagName?.toLowerCase() || 'component'}
              </Badge>
            </CardContent>
          </Card>
        </div>
        
        {/* Element ID */}
        {id && (
          <div>
            <h3 className="text-sm font-semibold">Element ID</h3>
            <Card className="mt-2 overflow-hidden">
              <CardContent className="p-3 text-sm">
                <Badge variant="outline" className="px-2 py-0.5 text-xs font-mono bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  {id}
                </Badge>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Classes */}
        {className && (
          <div>
            <h3 className="text-sm font-semibold">Classes</h3>
            <Card className="mt-2 overflow-hidden">
              <CardContent className="p-3 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  {className.split(' ').filter(Boolean).map((cls, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="px-2 py-0.5 text-xs font-mono bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"
                    >
                      {cls}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* CSS Selector */}
        <div>
          <h3 className="text-sm font-semibold">CSS Selector</h3>
          <Card className="mt-2 overflow-hidden">
            <CardContent className="p-3 text-xs font-mono bg-gray-50 dark:bg-zinc-900 overflow-x-auto">
              {selector}
            </CardContent>
          </Card>
        </div>
        
        {/* Element Size */}
        <div>
          <h3 className="text-sm font-semibold">Element Size</h3>
          <Card className="mt-2 overflow-hidden">
            <CardContent className="p-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Width</span>
                <span className="font-mono">{Math.round(rect?.width || 0)}px</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Height</span>
                <span className="font-mono">{Math.round(rect?.height || 0)}px</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Left</span>
                <span className="font-mono">{Math.round(rect?.left || 0)}px</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Top</span>
                <span className="font-mono">{Math.round(rect?.top || 0)}px</span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Attributes */}
        {attributes && Object.keys(attributes).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">Attributes</h3>
            <Card className="mt-2 overflow-hidden">
              <CardContent className="p-3 space-y-1.5 text-sm">
                {Object.entries(attributes)
                  .filter(([key]) => key !== 'class' && key !== 'id') // Filter out class and id as they're shown above
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="font-mono text-xs text-muted-foreground">{key}</span>
                      <span className="font-mono text-xs truncate max-w-[200px]">{value}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}; 