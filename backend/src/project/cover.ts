import * as path from 'path';
import { getMediaDir } from '../common/utils/common-path';

/**
 * Where a cover file lives on disk, when it is safe to delete.
 *
 * Replacing a cover deletes the one it replaces, or every preview would leak
 * another PNG. But a fork inherits the source's `photoUrl`, so one file can
 * back two projects — deleting it broke the other project's card, and a
 * project without a cover drops off the gallery, which requires one.
 *
 * `users` counts the rows still pointing at the url, including the project
 * being updated (its new url is not saved yet). One means nobody else.
 */
export function staleCoverPath(
  photoUrl: string | null | undefined,
  users: number,
): string | null {
  if (!photoUrl || users > 1) return null;
  return path.join(getMediaDir(), photoUrl.replace(/^\/media\//, ''));
}
