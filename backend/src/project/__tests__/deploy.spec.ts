import { collectFiles, deployToVercel, vercelPayload } from '../deploy';

const ok = (json: unknown) =>
  ({ ok: true, status: 200, text: async () => JSON.stringify(json) }) as Response;
const fail = (status: number, body: string) =>
  ({ ok: false, status, text: async () => body }) as Response;

describe('vercelPayload', () => {
  it('base64s each file under its own path', () => {
    const body = vercelPayload('p', [{ file: 'index.html', data: '<h1>hi</h1>' }]);
    expect(body.files).toEqual([
      {
        file: 'index.html',
        data: Buffer.from('<h1>hi</h1>').toString('base64'),
        encoding: 'base64',
      },
    ]);
  });

  it('makes a name Vercel will accept', () => {
    // Uppercase, spaces and dots are all rejected by the API; a project named
    // "My Site.v2" must not fail the deploy on the name alone.
    expect(vercelPayload('My Site.v2', []).name).toBe('codefox-my-site-v2');
    expect(vercelPayload('---', []).name).toBe('codefox');
    expect(vercelPayload('x'.repeat(200), []).name.length).toBeLessThanOrEqual(100);
  });

  it('declares no framework, so Vercel serves the files as they are', () => {
    expect(vercelPayload('p', []).projectSettings).toEqual({ framework: null });
  });
});

describe('deployToVercel', () => {
  it('returns the deployment url on success', async () => {
    const res = await deployToVercel('tok', 'p', [{ file: 'index.html', data: 'x' }], async () =>
      ok({ url: 'codefox-p-abc.vercel.app' }),
    );
    expect(res).toEqual({ ok: true, url: 'https://codefox-p-abc.vercel.app', message: '' });
  });

  it('sends the token as a bearer', async () => {
    let seen = '';
    await deployToVercel('secret-token', 'p', [{ file: 'a', data: 'b' }], async (_u, init) => {
      seen = (init?.headers as Record<string, string>)?.Authorization ?? '';
      return ok({ url: 'x.vercel.app' });
    });
    expect(seen).toBe('Bearer secret-token');
  });

  it("surfaces the provider's own message verbatim", async () => {
    // The whole point: "not authorized" and "name already taken" are both
    // 403, and only the body says which one the user has to fix.
    const res = await deployToVercel('tok', 'p', [{ file: 'a', data: 'b' }], async () =>
      fail(403, JSON.stringify({ error: { message: 'Not authorized: missing scope' } })),
    );
    expect(res.ok).toBe(false);
    expect(res.message).toBe('Not authorized: missing scope');
  });

  it('falls back to the raw body when the error is not JSON', async () => {
    const res = await deployToVercel('tok', 'p', [{ file: 'a', data: 'b' }], async () =>
      fail(502, 'upstream exploded'),
    );
    expect(res.message).toBe('upstream exploded');
  });

  it('refuses an empty project instead of posting nothing', async () => {
    let called = false;
    const res = await deployToVercel('tok', 'p', [], async () => {
      called = true;
      return ok({});
    });
    expect(called).toBe(false);
    expect(res.ok).toBe(false);
  });

  it('does not claim success when no url comes back', async () => {
    const res = await deployToVercel('tok', 'p', [{ file: 'a', data: 'b' }], async () => ok({}));
    expect(res.ok).toBe(false);
    expect(res.url).toBe('');
  });
});

describe('collectFiles', () => {
  const workspace = (files: Record<string, string>) =>
    ({
      listFiles: async () => Object.keys(files),
      readFile: async (p: string) => files[p] ?? null,
    }) as any;

  it('skips vcs, deps and agent scratch', async () => {
    const files = await collectFiles(
      workspace({
        'index.html': 'page',
        '.git/config': 'x',
        'node_modules/react/index.js': 'x',
        '.agent-runs/log': 'x',
        'assets/style.css': 'css',
      }),
    );
    expect(files.map((f) => f.file)).toEqual(['index.html', 'assets/style.css']);
  });

  it('drops a file that cannot be read rather than shipping null', async () => {
    const files = await collectFiles({
      listFiles: async () => ['index.html', 'gone.html'],
      readFile: async (p: string) => (p === 'index.html' ? 'ok' : null),
    } as any);
    expect(files).toEqual([{ file: 'index.html', data: 'ok' }]);
  });
});
