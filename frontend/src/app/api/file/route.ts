// app/api/file/route.ts
import { NextResponse } from 'next/server';
import { FileReader } from '@/utils/file-reader';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '@/app/log/logger';

export async function POST(req: Request) {
  logger.info('🚀 [API] Received POST request to update file');

  try {
    const { filePath, newContent } = await req.json();

    if (!filePath || !newContent) {
      logger.error('[API] Missing required parameters');
      return NextResponse.json(
        { error: "Missing 'filePath' or 'newContent'" },
        { status: 400 }
      );
    }
    const reader = FileReader.getInstance();
    reader.updateFile(filePath, newContent);

    logger.info('[API] File updated successfully');
    return NextResponse.json({
      message: 'File updated successfully',
      filePath,
    });
  } catch (error) {
    logger.error('[API] Error updating file:', error);
    return NextResponse.json(
      { error: 'Failed to update file' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json(
        { error: "Missing 'path' parameter" },
        { status: 400 }
      );
    }
    const reader = FileReader.getInstance();
    const content = await reader.readFileContent(filePath);
    const fileType = getFileType(filePath);
    const res = NextResponse.json({ filePath, content, type: fileType });
    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}

function getFileType(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';

  const typeMap: { [key: string]: string } = {
    //TODO: Add more file types
    tsx: 'typescriptreact',
    txt: 'text',
    md: 'markdown',
    json: 'json',
    js: 'javascript',
    ts: 'typescript',
    html: 'html',
    css: 'css',
    scss: 'scss',
    xml: 'xml',
    csv: 'csv',
    yml: 'yaml',
    yaml: 'yaml',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    svg: 'vector',
    webp: 'image',
    mp4: 'video',
    mp3: 'audio',
    wav: 'audio',
    pdf: 'pdf',
    zip: 'archive',
    tar: 'archive',
    gz: 'archive',
  };

  return typeMap[extension] || 'unknown';
}
