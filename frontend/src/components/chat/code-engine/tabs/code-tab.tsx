'use client';
import {
  useState,
  useEffect,
  useContext,
  useRef,
  MutableRefObject,
} from 'react';
import { motion } from 'framer-motion';
import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { TreeItem, TreeItemIndex } from 'react-complex-tree';
import { ProjectContext } from '../project-context';
import FileExplorerButton from '../file-explorer-button';
import FileStructure from '../file-structure';

interface CodeTabProps {
  editorRef: MutableRefObject<any>;
  fileStructureData: Record<TreeItemIndex, TreeItem<any>>;
  newCode: string;
  isFileStructureLoading: boolean;
  updateSavingStatus: (value: string) => void;
  filePath: string | null;
  setFilePath: (path: string | null) => void;
}

const CodeTab = ({
  editorRef,
  fileStructureData,
  newCode,
  isFileStructureLoading,
  updateSavingStatus,
  filePath,
  setFilePath,
}: CodeTabProps) => {
  const theme = useTheme();
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [isLoading] = useState(false);
  const [type, setType] = useState('javascript');

  useEffect(() => {
    if (filePath) {
      const extension = filePath.split('.').pop()?.toLowerCase();
      switch (extension) {
        case 'js':
        case 'jsx':
          setType('javascript');
          break;
        case 'ts':
        case 'tsx':
          setType('typescript');
          break;
        case 'html':
          setType('html');
          break;
        case 'css':
          setType('css');
          break;
        case 'json':
          setType('json');
          break;
        case 'md':
          setType('markdown');
          break;
        default:
          setType('plaintext');
      }
    }
  }, [filePath]);

  // Handle editor mount
  const handleEditorMount = (editorInstance) => {
    editorRef.current = editorInstance;
    editorInstance.getDomNode().style.position = 'absolute';
  };

  return (
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
          data={fileStructureData}
          filePath={filePath || ''}
          isLoading={isFileStructureLoading}
          onFileSelect={setFilePath}
        />
      </motion.div>

      {/* Code Editor */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          width="100%"
          defaultLanguage="typescript"
          value={newCode}
          language={type}
          loading={isLoading}
          onChange={updateSavingStatus}
          onMount={handleEditorMount}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            wordWrap: 'on',
            wrappingStrategy: 'advanced',
            folding: true,
            foldingHighlight: true,
            foldingStrategy: 'indentation',
            scrollbar: {
              useShadows: false,
              vertical: 'hidden',
              horizontal: 'hidden',
              verticalScrollbarSize: 0,
              horizontalScrollbarSize: 0,
            },
          }}
          theme={theme.theme === 'dark' ? 'vs-dark' : 'vs'}
        />
      </div>

      {/* File Explorer Toggle Button */}
      <FileExplorerButton
        isExplorerCollapsed={isExplorerCollapsed}
        setIsExplorerCollapsed={setIsExplorerCollapsed}
      />
    </>
  );
};

export default CodeTab;
