'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One node of the flat map the /api/project route returns. */
export interface TreeNode {
  index: string;
  data: string;
  isFolder: boolean;
  children: string[];
}

interface FileStructureProps {
  filePath: string;
  data: Record<string, TreeNode>;
  isLoading?: boolean;
  onFileSelect?: (path: string | null) => void;
}

const INDENT = 12;

/** Everything above `path`, as tree ids, so the selected file is revealed. */
const ancestorsOf = (path: string): string[] => {
  const parts = path.split('/');
  return parts
    .slice(0, -1)
    .map((_, i) => `root/${parts.slice(0, i + 1).join('/')}`);
};

/**
 * The project file tree.
 *
 * Hand-rolled rather than react-complex-tree: the library shipped its own
 * stylesheet, which is why this pane never matched the rest of the app, and
 * none of what it adds — drag, rename, multi-select — is wanted here. This is
 * a read-only picker.
 */
export default function FileStructure({
  filePath,
  data,
  isLoading = false,
  onFileSelect,
}: FileStructureProps) {
  const isEmpty = Object.keys(data).length === 0;
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root']));

  // Reveal whatever file the editor is showing, without collapsing the rest.
  useEffect(() => {
    if (!filePath) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      ancestorsOf(filePath).forEach((id) => next.add(id));
      return next;
    });
  }, [filePath]);

  // First load: open the source folder rather than a wall of config files.
  useEffect(() => {
    if (isEmpty) return;
    setExpanded((prev) =>
      prev.size > 1 ? prev : new Set([...prev, 'root/src'])
    );
  }, [isEmpty]);

  const selectedId = filePath ? `root/${filePath}` : null;

  const rows = useMemo(() => {
    const out: { node: TreeNode; depth: number }[] = [];
    const walk = (id: string, depth: number) => {
      const node = data[id];
      if (!node) return;
      out.push({ node, depth });
      if (node.isFolder && expanded.has(id)) {
        node.children.forEach((child) => walk(child, depth + 1));
      }
    };
    data.root?.children.forEach((id) => walk(id, 0));
    return out;
  }, [data, expanded]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (isLoading || isEmpty) {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Loader className="h-5 w-5 animate-spin text-primary" />
          <p className="font-mono text-xs text-muted-foreground">
            Reading project…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header count={rows.length} />
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {rows.map(({ node, depth }) => {
          const isSelected = node.index === selectedId;
          const isOpen = expanded.has(node.index);

          return (
            <button
              key={node.index}
              type="button"
              title={node.data}
              aria-current={isSelected ? 'true' : undefined}
              aria-expanded={node.isFolder ? isOpen : undefined}
              onClick={() =>
                node.isFolder
                  ? toggle(node.index)
                  : onFileSelect?.(node.index.replace(/^root\//, ''))
              }
              style={{ paddingLeft: 6 + depth * INDENT }}
              className={cn(
                'relative flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-[13px] transition-colors',
                isSelected
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {isSelected && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-primary"
                />
              )}

              {node.isFolder ? (
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-transform',
                    isOpen && 'rotate-90'
                  )}
                />
              ) : (
                // Keeps file names on the same rail as folder names.
                <span className="w-3.5 shrink-0" />
              )}

              <span className="truncate">{node.data}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Header({ count }: { count?: number }) {
  return (
    <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
      <h3 className="font-mono text-[10px] tracking-[0.12em] text-primary">
        FILES
      </h3>
      {count !== undefined && (
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {count}
        </span>
      )}
    </div>
  );
}
