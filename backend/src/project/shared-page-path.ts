/**
 * Which file inside a shared project a public url is asking for.
 *
 * A site may have more than one page — the agent is told to add `.html`
 * files and link between them — so `/share/<id>/about.html` has to resolve.
 * This turns an anonymous, attacker-controlled url into a path that is read
 * off disk, so it is deliberately narrow:
 *
 * - Only `.html`. The share route serves everything as `text/html`, and it
 *   answers without a session; a project's other files (an `.env` the agent
 *   wrote, a note the owner left) are not published just because the project
 *   is.
 * - One directory deep at most, and no traversal — a normalised path that
 *   climbs out is refused rather than clamped.
 *
 * Returns null when the request is not for a page of this site.
 */
export function sharedPagePath(
  urlPath: string,
  shareId: string,
): string | null {
  const prefix = `/share/${shareId}`;
  if (!urlPath.startsWith(prefix)) return null;

  let rest = urlPath.slice(prefix.length);
  // Drop a query string: Express gives req.path without one, but this
  // function's contract should not depend on that.
  rest = rest.split('?')[0];
  if (rest === '' || rest === '/') return 'index.html';
  if (!rest.startsWith('/')) return null;

  let file: string;
  try {
    file = decodeURIComponent(rest.slice(1));
  } catch {
    // Malformed percent-encoding.
    return null;
  }

  // A trailing slash means a directory, which this does not serve.
  if (file === '' || file.endsWith('/')) return null;
  // Backslashes and NUL are path separators or terminators somewhere.
  if (/[\\\0]/.test(file)) return null;

  const segments = file.split('/');
  if (segments.length > 2) return null;
  // `.` and `..` never name a page; an empty segment means a double slash.
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(segments.join(''))) return null;
  if (!/\.html?$/i.test(file)) return null;

  return file;
}
