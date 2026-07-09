'use client';
import { useEffect, useState } from 'react';
import {
  StaticTreeDataProvider,
  Tree,
  TreeItem,
  TreeItemIndex,
  UncontrolledTreeEnvironment,
} from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { Loader } from 'lucide-react';

export interface FileNodeType {
  name: string;
  type: 'file' | 'folder';
  children?: FileNodeType[];
}

interface FileStructureProps {
  filePath: string;
  data: Record<TreeItemIndex, TreeItem<string>>;
  isLoading?: boolean;
  onFileSelect?: (path: string | null) => void;
}

export default function FileStructure({
  filePath,
  data,
  isLoading = false,
  onFileSelect,
}: FileStructureProps) {
  const [dataProvider, setDataProvider] = useState(
    new StaticTreeDataProvider(data, (item, newName) => ({
      ...item,
      data: newName,
    }))
  );

  // Check if loading state should be displayed
  const isEmpty = Object.keys(data).length === 0;
  const showLoading = isLoading || isEmpty;

  // Update data provider when data changes
  useEffect(() => {
    if (!isEmpty) {
      setDataProvider(
        new StaticTreeDataProvider(data, (item, newName) => ({
          ...item,
          data: newName,
        }))
      );
    }
  }, [data, isEmpty]);

  // Handle file selection event
  const handleSelectItems = (items) => {
    if (items.length > 0) {
      const newPath = items[0].toString().replace(/^root\//, '');
      const selectedItem = data[items[0]];

      // Only set file path when a file (not folder) is selected
      if (selectedItem && !selectedItem.isFolder) {
        onFileSelect?.(newPath);
      }
    }
  };

  // Get expanded folders based on current file path
  const getExpandedFolders = () => {
    if (!filePath) return ['root'];

    const parts = filePath.split('/');
    const expandedFolders = ['root'];

    // Build path incrementally
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join('/');
      expandedFolders.push(`root/${folderPath}`);
    }

    return expandedFolders;
  };

  return (
    <div className="relative p-4 prose dark:prose-invert">
      <h3 className="mb-2 font-bold">File Explorer</h3>
      {filePath && (
        <div className="mt-4 p-2 text-sm break-all bg-muted/20 rounded-md">
          <span className="font-medium">Current file:</span> {filePath}
        </div>
      )}

      {showLoading ? (
        <div className="flex flex-col items-center justify-center h-48 space-y-3">
          <Loader className="w-6 h-6 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading files...</p>
        </div>
      ) : (
        <UncontrolledTreeEnvironment
          dataProvider={dataProvider}
          getItemTitle={(item) => item.data}
          viewState={{
            // Expand directories containing the current file
            ['fileTree']: {
              expandedItems: getExpandedFolders(),
            },
          }}
          onSelectItems={handleSelectItems}
          renderItem={({ item, depth, children, title, context, arrow }) => {
            const InteractiveComponent = context.isRenaming ? 'div' : 'button';
            const type = context.isRenaming ? undefined : 'button';
            return (
              <li
                {...(context.itemContainerWithChildrenProps as any)}
                className="rct-tree-item-li"
              >
                <div
                  {...(context.itemContainerWithoutChildrenProps as any)}
                  style={{ paddingLeft: `${(depth + 1) * 4}px` }}
                  className={[
                    'rct-tree-item-title-container group',
                    item.isFolder && 'rct-tree-item-title-container-isFolder',
                    context.isSelected &&
                      'rct-tree-item-title-container-selected',
                    context.isExpanded &&
                      'rct-tree-item-title-container-expanded',
                    context.isFocused &&
                      'rct-tree-item-title-container-focused',
                    context.isDraggingOver &&
                      'rct-tree-item-title-container-dragging-over',
                    context.isSearchMatching &&
                      'rct-tree-item-title-container-search-match',
                  ].join(' ')}
                >
                  {arrow}
                  <InteractiveComponent
                    type={type}
                    {...(context.interactiveElementProps as any)}
                    className={[
                      'rct-tree-item-button transition-colors duration-200',
                      'dark:text-white dark:group-hover:text-black',
                      context.isSelected &&
                        'dark:!bg-gray-700 dark:!text-white',
                    ].join(' ')}
                  >
                    {title}
                  </InteractiveComponent>
                </div>
                {children}
              </li>
            );
          }}
        >
          <Tree treeId="fileTree" rootItem="root" />
        </UncontrolledTreeEnvironment>
      )}
    </div>
  );
}
