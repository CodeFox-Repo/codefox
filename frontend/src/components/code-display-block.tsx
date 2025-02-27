'use client';
import { CheckIcon, CopyIcon } from '@radix-ui/react-icons';
import React from 'react';
import { CodeBlock, dracula, github } from 'react-code-blocks';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

interface ButtonCodeblockProps {
  code: string;
  lang: string;
}

export default function CodeDisplayBlock({ code, lang }: ButtonCodeblockProps) {
  const [isCopied, setisCopied] = React.useState(false);
  const { theme } = useTheme();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setisCopied(true);
    toast.success('Code copied to clipboard!');
    setTimeout(() => {
      setisCopied(false);
    }, 1500);
  };

  return (
    <div className="relative my-4 overflow-scroll overflow-x-scroll flex flex-col text-start rounded-lg border bg-muted">
      <Button
        onClick={copyToClipboard}
        variant="secondary"
        size="icon"
        className="h-6 w-6 absolute top-3 right-3 opacity-50 hover:opacity-100 transition-opacity"
      >
        {isCopied ? (
          <CheckIcon className="w-4 h-4 scale-100 transition-all" />
        ) : (
          <CopyIcon className="w-4 h-4 scale-100 transition-all" />
        )}
      </Button>
      <CodeBlock
        customStyle={{
          background: 'transparent',
          padding: '1rem',
        }}
        text={code}
        language="tsx"
        showLineNumbers={false}
        theme={theme === 'dark' ? dracula : github}
      />
    </div>
  );
}
