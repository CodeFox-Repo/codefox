import { escapeAttribute, publicOrigin, withSocialCard } from '../social-card';

const req = (headers: Record<string, string | string[]>): any => ({ headers });
const vercel = req({
  'x-forwarded-host': 'codefox.sma1lboy.me',
  'x-forwarded-proto': 'https',
  host: 'backend-production.up.railway.app',
});

const page = (head = '', body = '<h1>hi</h1>') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('publicOrigin', () => {
  it('prefers the host the visitor actually typed', () => {
    // req.headers.host is the API host behind the rewrite, which is not where
    // anyone opened the link.
    expect(publicOrigin(vercel)).toBe('https://codefox.sma1lboy.me');
  });

  it('takes the first entry of a forwarded chain', () => {
    expect(
      publicOrigin(req({ 'x-forwarded-host': 'a.example.com, b.internal' })),
    ).toBe('https://a.example.com');
  });

  it('refuses a host that is not host-shaped', () => {
    // This header decides a url that ends up in a public page.
    expect(publicOrigin(req({ host: 'evil.com/"><script>' }))).toBe('');
    expect(publicOrigin(req({}))).toBe('');
  });

  it('keeps http only when that is what was asked for', () => {
    expect(
      publicOrigin(req({ host: 'localhost:8080', 'x-forwarded-proto': 'http' })),
    ).toBe('http://localhost:8080');
    expect(publicOrigin(req({ host: 'localhost:8080' }))).toBe(
      'https://localhost:8080',
    );
  });
});

describe('withSocialCard', () => {
  it('gives a page a title and an image from its cover', () => {
    const out = withSocialCard(
      page(),
      { projectName: 'Fox Timer', photoUrl: '/media/projects/p1/cover.png' },
      vercel,
    );
    expect(out).toContain('<meta property="og:title" content="Fox Timer">');
    expect(out).toContain(
      '<meta property="og:image" content="https://codefox.sma1lboy.me/api/media/projects/p1/cover.png">',
    );
    expect(out).toContain(
      '<meta name="twitter:card" content="summary_large_image">',
    );
  });

  it('falls back to the small card when there is no cover yet', () => {
    const out = withSocialCard(page(), { projectName: 'No Cover' }, vercel);
    expect(out).toContain('<meta name="twitter:card" content="summary">');
    expect(out).not.toContain('og:image');
  });

  it('never overrides tags the page already declares', () => {
    // The agent may have written its own — that is the author's intent.
    const out = withSocialCard(
      page('<meta property="og:title" content="Chosen by the agent">'),
      { projectName: 'Row Name' },
      vercel,
    );
    expect(out).toContain('Chosen by the agent');
    expect(out).not.toContain('Row Name');
  });

  it('escapes a project name that would break out of the attribute', () => {
    const out = withSocialCard(
      page(),
      { projectName: '"><script>alert(1)</script>' },
      vercel,
    );
    expect(out).not.toContain('<script>alert(1)');
    expect(out).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('leaves a page with no head exactly as it was', () => {
    const raw = '<h1>fragment</h1>';
    expect(withSocialCard(raw, { projectName: 'x' }, vercel)).toBe(raw);
  });

  it('keeps the page body untouched', () => {
    const out = withSocialCard(page('', '<p>content</p>'), { projectName: 'x' }, vercel);
    expect(out).toContain('<body><p>content</p></body>');
  });
});

describe('escapeAttribute', () => {
  it('handles every character that ends an attribute', () => {
    expect(escapeAttribute(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});
