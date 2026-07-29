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
 * What the bytes themselves say the file is.
 *
 * Both the MIME type and the filename come from the client, so checking only
 * those accepted anything at all as long as it was *called* a PNG — a shell
 * script renamed `evil.png` was stored and then served from this origin.
 * Returns undefined when the header matches no image this service accepts.
 */
/**
 * What a buffer actually is, by its magic bytes — the one thing a client
 * cannot lie about. Exported because chat attachments arrive by a different
 * road (base64 data URLs, not multipart) and need the same answer.
 */
export function sniff(buffer: Buffer): string | undefined {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  // GIF87a / GIF89a. Not accepted for avatars or covers, but the agent can
  // be handed one, so the sniffer has to be able to name it.
  if (buffer.length >= 6 && buffer.subarray(0, 3).toString('ascii') === 'GIF') {
    return 'image/gif';
  }
  return undefined;
}

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

  const buffer = Buffer.concat(chunks);

  // The decisive check, and the only one the client cannot lie about. The
  // sniffed type is also what gets returned, so the stored file's extension
  // describes what is actually in it.
  // Checked against the allow-list, not merely for being recognisable: the
  // sniffer also knows GIF, which chat attachments accept and this path does
  // not — otherwise a .gif renamed .png would pass here.
  const actual = sniff(buffer);
  if (!actual || !ALLOWED_MIME_TYPES.includes(actual)) {
    throw new BadRequestException(
      'That file is not a JPEG, PNG, or WebP image.',
    );
  }

  return { buffer, mimetype: actual };
}
