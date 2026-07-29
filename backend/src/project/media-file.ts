import * as path from 'path';
import { getMediaDir } from '../common/utils/common-path';

/**
 * Where a stored media file lives on disk, when it is safe to delete.
 *
 * Replacing an image deletes the one it replaces, or every upload would leak
 * another file onto the volume. Two things make that delete dangerous:
 *
 * - A fork inherits the source project's `photoUrl`, so one file can back two
 *   projects. Deleting it broke the other project's card, and a project
 *   without a cover drops off the gallery, which requires one. `users` counts
 *   the rows still pointing at the url — including the one being updated,
 *   whose new url is not saved yet — so one means nobody else.
 *
 * - The url is turned back into a path. These urls are server-generated today
 *   (a uuid under /media/), but "delete the path in this column" is one bad
 *   column away from deleting anything on disk, so the result is confined to
 *   the media directory here rather than at each call site.
 */
export function staleMediaPath(
  url: string | null | undefined,
  users: number,
): string | null {
  if (!url || users > 1) return null;
  if (!url.startsWith('/media/')) return null;

  const full = path.resolve(getMediaDir(), url.slice('/media/'.length));
  const root = path.resolve(getMediaDir());
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}
