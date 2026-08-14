import type { Request } from 'express';
import { shareChrome, socialTagsFor } from '../share-chrome';

const req = (headers: Record<string, string> = {}) =>
  ({ headers, get: (h: string) => headers[h.toLowerCase()] }) as unknown as Request;

const chrome = (over: Record<string, unknown> = {}) =>
  shareChrome({
    project: {
      id: 'row-9',
      projectName: 'Roast Landing',
      uniqueProjectId: 'abc-123',
      user: { username: 'sam' },
      ...over,
    } as any,
    head: '<meta property="og:title" content="Roast Landing">',
    frameSrc: '/share/abc-123?raw=1',
    appOrigin: 'https://codefox.example',
  });

describe('share chrome', () => {
  it('keeps the page sandboxed inside the frame', () => {
    const html = chrome();
    const sandbox = html.match(/sandbox="([^"]*)"/)?.[1] ?? '';
    expect(sandbox).toContain('allow-scripts');
    // The escape hatch: allow-same-origin next to allow-scripts lets the
    // framed page reach into this document and drop its own sandbox.
    expect(sandbox).not.toContain('allow-same-origin');
    // No top navigation, so the page cannot replace the tab it is framed in.
    expect(sandbox).not.toContain('allow-top-navigation');
    expect(html).toContain('src="/share/abc-123?raw=1"');
  });

  it('shows the byline and a Remix link', () => {
    const html = chrome();
    expect(html).toContain('Roast Landing');
    expect(html).toContain('by sam');
    // The row id, not the share id: the landing page forks by row id, and
    // resolving a share id meant searching a six-item wall.
    expect(html).toContain('https://codefox.example/?remix=row-9');
    expect(html).toContain('Built with CodeFox');
  });

  it('escapes a project name rather than rendering it as markup', () => {
    // The name is user input and lands in the title, the header and the
    // iframe's title attribute.
    const html = chrome({ projectName: '"><script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes a username the same way', () => {
    const html = chrome({ user: { username: '<img onerror=x>' } });
    expect(html).not.toContain('<img onerror=x>');
  });

  it('renders without a byline when the publisher is unknown', () => {
    const html = chrome({ user: null });
    // The rendered byline span, not the `.by` CSS rule. Empty apart from the
    // separator space between author and remix count, both of which are
    // absent here.
    expect(html).toMatch(/<span class="by">\s*<\/span>/);
    expect(html).toContain('Roast Landing');
  });

  it('carries the social tags into the outer document', () => {
    // A crawler reads this page, never the framed one, so the card has to
    // live here.
    const tags = socialTagsFor(
      { projectName: 'Roast Landing', photoUrl: 'media/cover.png' },
      req({ 'x-forwarded-host': 'codefox.example', 'x-forwarded-proto': 'https' }),
    );
    expect(tags).toContain('og:title');
    expect(tags).toContain('twitter:card');
    expect(tags).toContain('https://codefox.example/api/media/cover.png');
    expect(chrome().includes('og:title')).toBe(true);
  });

  it('does not let a project name break out through $ substitution', () => {
    // social-card was bitten by String.replace treating `$\`` in the name as
    // a substitution pattern; the tags it returns must stay literal here.
    const tags = socialTagsFor({ projectName: 'Cool $` $& $1' }, req());
    // `&` is entity-escaped (correct); the point is that $-patterns survive
    // literally instead of being expanded into surrounding markup.
    expect(tags).toContain('Cool $` $&amp; $1');
    expect(tags).not.toContain('<head>');
  });

  it('shows a remix count only once someone has remixed it', () => {
    // "0 remixes" makes a new page look ignored.
    // The count lives in the byline; "remix" alone also matches the button.
    const count = (html: string) => html.match(/· \d+ remix\w*/)?.[0] ?? null;
    expect(count(chrome({ subNumber: 0 }))).toBeNull();
    expect(count(chrome({ subNumber: undefined }))).toBeNull();
    expect(count(chrome({ subNumber: 1 }))).toBe('· 1 remix');
    expect(count(chrome({ subNumber: 4 }))).toBe('· 4 remixes');
  });
});
