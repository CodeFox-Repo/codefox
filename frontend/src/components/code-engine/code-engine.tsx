'use client';

import { useContext, useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import FileStructure, { FileNodeType } from './file-structure';
import { ProjectContext } from './project-context';

// Import icon components for header tabs and explorer toggle
import {
  Eye,
  Code as CodeIcon,
  Terminal,
  GitFork,
  Share2,
  Copy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import FileExplorerButton from './file-explorer-button';
import { useTheme } from 'next-themes';
import { TreeItemIndex, TreeItem } from 'react-complex-tree';

export function CodeEngine() {
  const editorRef = useRef(null);
  const { projectId, filePath } = useContext(ProjectContext);
  const [preCode, setPrecode] = useState('// some comment');
  const [newCode, setCode] = useState('// some comment');
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState('javascript');
  const [isLoading, setIsLoading] = useState(false);
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [fileStructureData, setFileStructureData] = useState<
    Record<TreeItemIndex, TreeItem<any>>
  >({});
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'console'>(
    'code'
  );

  // Handle mounting of the editor.
  const handleEditorMount = (editorInstance) => {
    editorRef.current = editorInstance;
    // Set the editor DOM node's position for layout control.
    editorInstance.getDomNode().style.position = 'absolute';
  };

  // Fetch file content when filePath or projectId changes.
  useEffect(() => {
    async function getCode() {
      try {
        setIsLoading(true);
        const res = await fetch(
          `/api/file?path=${encodeURIComponent(`${projectId}/${filePath}`)}`
        ).then((res) => res.json());
        setCode(res.content);
        setPrecode(res.content);
        setType(res.type);
        setIsLoading(false);
      } catch (error: any) {
        console.error(error.message);
      }
    }
    getCode();
  }, [filePath, projectId]);

  // Fetch file structure when projectId changes.
  useEffect(() => {
    async function fetchFiles() {
      try {
        const response = await fetch(`/api/project?id=${projectId}`);
        const data = await response.json();
        setFileStructureData(data.res || {});
      } catch (error) {
        console.error('Error fetching file structure:', error);
      }
    }
    fetchFiles();
  }, [projectId]);

  const handleReset = () => {
    setCode(preCode);
    editorRef.current?.setValue(preCode);
    setSaving(false);
  };

  const updateCode = async (value) => {
    try {
      const response = await fetch('/api/file', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: `${projectId}/${filePath}`,
          newContent: JSON.stringify(value),
        }),
      });
      await response.json();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSave = () => {
    setSaving(false);
    setPrecode(newCode);
    updateCode(newCode);
  };

  const updateSavingStatus = (value) => {
    setCode(value);
    setSaving(true);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-2 border-b">
        {/* Left Section: Tab triggers and explorer toggle */}
        <div className="flex items-center space-x-2">
          <Button
            variant={activeTab === 'preview' ? 'default' : 'outline'}
            onClick={() => setActiveTab('preview')}
            className="text-sm"
          >
            <Eye className="w-4 h-4 mr-1" />
            Preview
          </Button>
          <Button
            variant={activeTab === 'code' ? 'default' : 'outline'}
            onClick={() => setActiveTab('code')}
            className="text-sm"
          >
            <CodeIcon className="w-4 h-4 mr-1" />
            Code
          </Button>
          <Button
            variant={activeTab === 'console' ? 'default' : 'outline'}
            onClick={() => setActiveTab('console')}
            className="text-sm"
          >
            <Terminal className="w-4 h-4 mr-1" />
            Console
          </Button>
          {/* {activeTab === 'code' && (
            <Button
              variant="ghost"
              onClick={() => setIsExplorerCollapsed(!isExplorerCollapsed)}
              className="ml-2"
            >
              {isExplorerCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </Button>
          )} */}
        </div>
        {/* Right Section: Icon buttons and text buttons */}
        <div className="flex items-center space-x-4">
          {/* Icon Buttons */}
          <div className="flex items-center space-x-2">
            <Button variant="ghost" className="p-0">
              <GitFork className="w-5 h-5" />
            </Button>
            <Button variant="ghost" className="p-0">
              <Share2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" className="p-0">
              <Copy className="w-5 h-5" />
            </Button>
          </div>
          {/* Text Buttons */}
          <div className="flex items-center space-x-2">
            <Button variant="outline" className="text-sm">
              Supabase
            </Button>
            <Button variant="outline" className="text-sm">
              Publish
            </Button>
            <Button variant="outline" className="text-sm">
              Deploy
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'code' ? (
          <>
            {/* File Explorer Panel (collapsible) */}
            <motion.div
              animate={{
                width: isExplorerCollapsed ? '0px' : '300px',
                opacity: isExplorerCollapsed ? 0 : 1,
              }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-y-auto border-r"
            >
              <FileStructure
                isCollapsed={isExplorerCollapsed}
                data={fileStructureData}
                filePath={filePath}
              />
            </motion.div>
            <div className="flex-1 relative">
              <Editor
                height="100vh"
                width="100%"
                defaultLanguage="typescript"
                value={newCode}
                language={type}
                loading={isLoading}
                onChange={updateSavingStatus}
                onMount={handleEditorMount}
                options={{
                  fontSize: 14,
                  minimap: {
                    enabled: false,
                  },
                  scrollbar: {
                    useShadows: false,
                    vertical: 'visible',
                    horizontal: 'visible',
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                }}
                theme={theme.theme === 'dark' ? 'vs-dark' : 'vs'}
              />
            </div>
          </>
        ) : activeTab === 'preview' ? (
          <div className="flex-1 p-4 text-sm">Preview Content (Mock)</div>
        ) : activeTab === 'console' ? (
          <div className="flex-1 p-4 text-sm">Console Content (Mock)</div>
        ) : null}
      </div>

      {/* Save Changes Bar */}
      {saving && (
        <SaveChangesBar
          saving={saving}
          onSave={handleSave}
          onReset={handleReset}
        />
      )}

      {/* close explored bar */}
      {activeTab === 'code' && (
        <FileExplorerButton
          isExplorerCollapsed={isExplorerCollapsed}
          setIsExplorerCollapsed={setIsExplorerCollapsed}
        />
      )}
    </div>
  );
}

const SaveChangesBar = ({ saving, onSave, onReset }) => {
  return (
    saving && (
      <div className="fixed bottom-4 right-4 flex items-center space-x-2 p-2 border rounded-full shadow bg-background">
        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
        <span className="text-sm text-foreground">Unsaved Changes</span>
        <Button
          variant="outline"
          className="px-3 py-1 text-sm font-medium rounded-full"
          onClick={onReset}
        >
          Reset
        </Button>
        <Button
          variant="default"
          className="px-4 py-1 text-sm font-medium rounded-full"
          onClick={onSave}
        >
          Save
        </Button>
      </div>
    )
  );
};
