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
    logger.info(`📁 getMediaDir = ${mediaDir}`);
    const filePath = path.join(mediaDir, ...params.path);
    const normalizedPath = path.normalize(filePath);
    logger.info(`📁 getMediaDir = ${mediaDir}`);
    logger.info(`📂 full filePath = ${filePath}`);
    logger.debug(`Requested path: ${params.path.join('/')}`);
    logger.debug(`Full resolved path: ${filePath}`);

    if (!normalizedPath.startsWith(mediaDir)) {
      logger.warn('⛔ Directory traversal attempt blocked:', filePath);
      return new Response('Access denied', { status: 403 });
    }

    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    const ext = path.extname(filePath).toLowerCase();
    logger.debug(`File extension: ${ext}`);
    if (!contentTypeMap[ext]) {
      logger.warn(`⛔ Forbidden file type: ${ext}`);
      return new Response('Forbidden file type', { status: 403 });
    }

    let fileStat;
    try {
      fileStat = await fs.stat(filePath);
    } catch (err) {
      logger.warn(`❌ File not found at path: ${filePath}`);
      return new Response('File not found', { status: 404 });
    }

    if (fileStat.size > 10 * 1024 * 1024) {
      logger.warn(`📦 File too large (${fileStat.size} bytes): ${filePath}`);
      return new Response('File too large', { status: 413 });
    }

    const fileBuffer = await fs.readFile(filePath);
    logger.info(`✅ Serving file: ${filePath}`);

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentTypeMap[ext],
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error: any) {
    logger.error('🔥 Error serving media file:', error);
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? `Error serving file: ${error.message}`
        : 'An error occurred while serving the file';

    return new Response(errorMessage, { status: 500 });
  }
}
