import { NextRequest } from 'next/server';
import fs from 'fs/promises'; // Use promises API
import path from 'path';
import { getMediaDir } from 'codefox-common';
import { logger } from '@/app/log/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const mediaDir = getMediaDir();
    const filePath = path.join(mediaDir, ...params.path);
    const normalizedPath = path.normalize(filePath);

    if (!normalizedPath.startsWith(mediaDir)) {
      logger.error('Possible directory traversal attempt:', filePath);
      return new Response('Access denied', { status: 403 });
    }

    // File extension allowlist
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    const ext = path.extname(filePath).toLowerCase();
    if (!contentTypeMap[ext]) {
      return new Response('Forbidden file type', { status: 403 });
    }

    // File existence and size check
    let fileStat;
    try {
      fileStat = await fs.stat(filePath);
    } catch (err) {
      return new Response('File not found', { status: 404 });
    }

    if (fileStat.size > 10 * 1024 * 1024) {
      // 10MB limit
      return new Response('File too large', { status: 413 });
    }

    // Read and return the file
    const fileBuffer = await fs.readFile(filePath);
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentTypeMap[ext],
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    logger.error('Error serving media file:', error);
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? `Error serving file: ${error.message}`
        : 'An error occurred while serving the file';

    return new Response(errorMessage, { status: 500 });
  }
}
