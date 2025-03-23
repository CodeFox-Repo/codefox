'use client';

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/const/MessageType';

interface ThinkingProcessBlockProps {
  thinking: Message;
}

export default function ThinkingProcessBlock({
  thinking,
}: ThinkingProcessBlockProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-muted-foreground/80 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Thinking Process
      </button>
      {isExpanded && (
        <div className="mt-2 mb-4 pl-4 text-sm text-muted-foreground border-l-2 border-muted/20">
          <Markdown remarkPlugins={[remarkGfm]}>{thinking.content}</Markdown>
        </div>
      )}
    </>
  );
}
