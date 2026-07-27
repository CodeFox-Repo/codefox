// app/api/project/route.ts
import { NextResponse } from 'next/server';
import { FileReader } from '@/utils/file-reader';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('path');

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  try {
    const res = await fetchFileStructure(projectId);
    return NextResponse.json({ res });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read project files' },
      { status: 500 }
    );
  }
}

const emptyTree = () => ({
  root: {
    index: 'root',
    isFolder: true,
    children: [],
    data: 'Root',
    canMove: false,
    canRename: false,
  },
});

/**
 * Folders first, then real names before dotfiles, then alphabetical.
 * Without the dot rule a Next.js project opens on a screen of .editorconfig /
 * .npmrc / .prettierrc before `src` is visible at all.
 */
const compare = (
  a: { name: string; isFolder: boolean },
  b: { name: string; isFolder: boolean }
) => {
  if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
  const aDot = a.name.startsWith('.');
  const bDot = b.name.startsWith('.');
  if (aDot !== bDot) return aDot ? 1 : -1;
  return a.name.localeCompare(b.name, undefined, { numeric: true });
};

async function fetchFileStructure(projectId: string) {
  const reader = FileReader.getInstance();
  const paths = await reader.getAllPaths(projectId);
  if (!paths || paths.length === 0) return emptyTree();

  const projectPrefix = paths[0].split('/')[0] + '/';
  const cleaned = paths
    .map((p) => p.replace(projectPrefix, ''))
    .filter(Boolean);

  // A segment is a folder when some path continues past it. Deriving that from
  // the path set is the only reliable signal — the previous version guessed
  // from the filename, so `.github` was a "file" (and rendered flat next to its
  // own children) while `Dockerfile` was a "folder".
  const folders = new Set<string>();
  const childrenOf = new Map<string, Set<string>>();

  for (const path of cleaned) {
    const parts = path.split('/');
    for (let i = 0; i < parts.length; i++) {
      const parent = parts.slice(0, i).join('/');
      if (!childrenOf.has(parent)) childrenOf.set(parent, new Set());
      childrenOf.get(parent)!.add(parts[i]);
      if (i > 0) folders.add(parent);
    }
  }

  const items: Record<string, unknown> = {};

  const build = (parentPath: string): string[] =>
    [...(childrenOf.get(parentPath) ?? [])]
      .map((name) => {
        const path = parentPath ? `${parentPath}/${name}` : name;
        return { name, path, isFolder: folders.has(path) };
      })
      .sort(compare)
      .map(({ name, path, isFolder }) => {
        const id = `root/${path}`;
        items[id] = {
          index: id,
          data: name,
          isFolder,
          canMove: false,
          canRename: false,
          children: isFolder ? build(path) : [],
        };
        return id;
      });

  const rootChildren = build('');

  return {
    root: {
      index: 'root',
      isFolder: true,
      canMove: false,
      canRename: false,
      children: rootChildren,
      data: 'Root',
    },
    ...items,
  };
}
