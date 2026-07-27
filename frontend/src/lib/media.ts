/**
 * Resolve a stored media path to something the browser can fetch.
 *
 * The API stores uploads as `/media/<key>` (see UploadService); the Next route
 * that serves them is `/api/media/<key>`. Absolute URLs (the S3 case) pass
 * through untouched.
 */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:/i.test(path)) return path;
  return `/api/media/${path.replace(/^\/?media\//, '').replace(/^\//, '')}`;
}
