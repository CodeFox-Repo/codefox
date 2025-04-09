import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InfoTabProps } from '../types';

/**
 * Info tab - Displays information about the selected component
 */
export const InfoTab: React.FC<InfoTabProps> = ({ 
  selectedComponent,
  setIsInspectMode,
  populateChatInput 
}) => {
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
      </div>
    </ScrollArea>
  );
}; 