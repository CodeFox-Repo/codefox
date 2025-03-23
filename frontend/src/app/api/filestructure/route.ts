// app/api/filestructure/route.ts
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

async function fetchFileStructure(projectId) {
  const reader = FileReader.getInstance();
  const res = await reader.getAllPaths(projectId);
  if (!res || res.length === 0) {
    return '';
  }
  return res;
}
