import { BadRequestException } from '@nestjs/common';
import { FileUpload } from 'graphql-upload-minimal';
import path from 'path';

/** Maximum allowed file size (5MB) */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/** Allowed image MIME types */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Allowed file extensions */
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validates a file upload (size, type) and returns a Buffer.
 * @param file - FileUpload object from GraphQL
 * @returns Promise<Buffer> - The file data in buffer format
 * @throws BadRequestException - If validation fails
 */
export async function validateAndBufferFile(
  file: FileUpload,
): Promise<{ buffer: Buffer; mimetype: string }> {
  const { filename, createReadStream, mimetype } = await file;

  // Extract the file extension
  const extension = path.extname(filename).toLowerCase();

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    throw new BadRequestException(
      `Invalid file type: ${mimetype}. Only JPEG, PNG, and WebP are allowed.`,
    );
  }

  // Validate file extension
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new BadRequestException(
      `Invalid file extension: ${extension}. Only .jpg, .jpeg, .png, and .webp are allowed.`,
    );
  }

  const chunks: Buffer[] = [];
  let fileSize = 0;

  // Read file stream and check size
  for await (const chunk of createReadStream()) {
    fileSize += chunk.length;
    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(
        'File size exceeds the maximum allowed limit (5MB).',
      );
    }
    chunks.push(chunk);
  }

  return { buffer: Buffer.concat(chunks), mimetype };
}
