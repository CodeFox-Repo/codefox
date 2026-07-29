import type { Request } from 'express';

/** Escape for an HTML attribute value. Project names are user-supplied. */
export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The origin a visitor actually typed, so the card points at the product's
 * domain rather than the API host behind the rewrite.
 */
export function publicOrigin(req: Request): string {
  // Set by Vercel's rewrite and by most proxies. `req.headers.host` alone is
  // the backend's own hostname, which is not where anyone opened the link.
  const forwardedHost = first(req.headers['x-forwarded-host']);
  const host = forwardedHost || first(req.headers.host);
  if (!host) return '';
  // A header, so it decides a URL that ends up in a public page: keep it to
  // something host-shaped rather than passing it through.
  if (!/^[a-z0-9.\-:]+$/i.test(host)) return '';
  const proto = first(req.headers['x-forwarded-proto']) || 'https';
  return `${proto === 'http' ? 'http' : 'https'}://${host}`;
}

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim() ?? '';

/**
 * Give a shared page a link preview.
 *
 * Pasted into Slack, iMessage or a tweet, a share link showed a bare url:
 * the generated page has whatever `<title>` the agent wrote and nothing else,
 * so there was no name, no description and no image. The cover screenshot
 * already exists and is already served publicly — this is the wiring, not new
 * machinery.
 *
 * The tags go at the very top of `<head>` and never replace what the page
 * already declares: the agent may have written its own og:tags, and those are
 * the author's intent. Crawlers take the first occurrence of a property, so
 * ours only fill gaps in practice — hence `skip`.
 */
export function withSocialCard(
  html: string,
  project: { projectName?: string | null; photoUrl?: string | null },
  req: Request,
): string {
  const head = html.match(/<head[^>]*>/i);
  // No <head> to inject into. A page that unusual is served as it is rather
  // than rebuilt around an assumption.
  if (!head) return html;

  const origin = publicOrigin(req);
  const title = (project.projectName || 'A page built with CodeFox').slice(
    0,
    120,
  );
  const image =
    project.photoUrl && origin
      ? `${origin}/api/media/${project.photoUrl.replace(/^\/?media\//, '')}`
      : '';

  const declared = (property: string) =>
    new RegExp(
      `<meta[^>]+(property|name)\\s*=\\s*["']${property}["']`,
      'i',
    ).test(html);

  // og: and twitter: are two spellings of one idea. A page that declared only
  // og:title used to still get our twitter:title, so the same link showed the
  // author's title on Slack and the project's row name on Twitter.
  const TWIN: Record<string, string> = {
    'og:title': 'twitter:title',
    'twitter:title': 'og:title',
    'og:image': 'twitter:image',
    'twitter:image': 'og:image',
  };

  const tags: string[] = [];
  const add = (property: string, content: string) => {
    if (!content) return;
    const twin = TWIN[property];
    if (declared(property) || (twin && declared(twin))) return;
    const attribute = property.startsWith('twitter:') ? 'name' : 'property';
    tags.push(
      `<meta ${attribute}="${property}" content="${escapeAttribute(content)}">`,
    );
  };

  add('og:type', 'website');
  add('og:title', title);
  add('og:description', 'Built with CodeFox.');
  add('og:image', image);
  add('twitter:card', image ? 'summary_large_image' : 'summary');
  add('twitter:title', title);
  add('twitter:image', image);

  if (tags.length === 0) return html;
  return html.replace(head[0], `${head[0]}\n${tags.join('\n')}`);
}
