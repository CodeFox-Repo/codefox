import { PreviewService } from '../preview.service';

/**
 * The three failure modes the start()/exit bookkeeping exists to prevent.
 * `spawnPreview` is stubbed so nothing here boots a real dev server — what is
 * under test is the map bookkeeping around it, which is where the leaks were.
 */
describe('PreviewService.start', () => {
  const service = () => new PreviewService();

  it('boots one dev server for concurrent starts of the same project', async () => {
    const previews = service();
    let spawns = 0;
    (previews as any).spawnPreview = async (projectPath: string) => {
      spawns++;
      await new Promise((r) => setTimeout(r, 20));
      (previews as any).previews.set(projectPath, {
        port: 4000,
        child: { killed: false, exitCode: null, signalCode: null },
        ready: Promise.resolve(),
        log: [],
        lastUsed: Date.now(),
      });
      return { port: 4000 };
    };

    const [a, b, c] = await Promise.all([
      previews.start('p1'),
      previews.start('p1'),
      previews.start('p1'),
    ]);

    // Without the in-flight map each of these spawned its own `next dev` and
    // all but the last became unreachable — running, unkillable, unswept.
    expect(spawns).toBe(1);
    expect([a.port, b.port, c.port]).toEqual([4000, 4000, 4000]);
  });

  it('forgets a start that never became ready, so the next one can retry', async () => {
    const previews = service();
    let attempts = 0;
    (previews as any).spawnPreview = async (projectPath: string) => {
      attempts++;
      if (attempts === 1) throw new Error('did not start in time');
      (previews as any).previews.set(projectPath, {
        port: 4100,
        child: { killed: false, exitCode: null, signalCode: null },
        ready: Promise.resolve(),
        log: [],
        lastUsed: Date.now(),
      });
      return { port: 4100 };
    };

    await expect(previews.start('p2')).rejects.toThrow('did not start in time');
    // A cached, permanently-rejected `ready` used to make the project
    // un-previewable until the whole backend restarted.
    await expect(previews.start('p2')).resolves.toEqual({ port: 4100 });
    expect(attempts).toBe(2);
  });

  it('a dying old child does not evict the restarted one from the map', () => {
    const previews = service();
    const oldChild = { killed: true };
    const newChild = { killed: false };
    const map = (previews as any).previews as Map<string, any>;

    map.set('p3', { port: 1, child: newChild, ready: Promise.resolve(), log: [], lastUsed: 0 });

    // What the old child's late 'exit' handler does now: it checks identity
    // first. Unconditionally deleting here orphaned the fresh dev server.
    if (map.get('p3')?.child === oldChild) map.delete('p3');

    expect(previews.portFor('p3')).toBe(1);
  });
});
