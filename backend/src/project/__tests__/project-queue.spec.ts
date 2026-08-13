import { busy, queueForProject } from '../project-queue';

/**
 * The invariant the turn queue was built for, now shared with restyle: two
 * writers against one project never overlap. A read-modify-write that
 * interleaves is exactly how a turn's work vanished with no error.
 */
describe('queueForProject', () => {
  const settle = () => new Promise((r) => setTimeout(r, 5));

  it('runs work for one project one at a time', async () => {
    const events: string[] = [];
    const job = (name: string) => async () => {
      events.push(`${name}:start`);
      await settle();
      events.push(`${name}:end`);
    };

    await Promise.all([
      queueForProject('p', job('a')),
      queueForProject('p', job('b')),
    ]);

    // Interleaved would read a:start, b:start, … — the corruption case.
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('does not serialise across different projects', async () => {
    const running: string[] = [];
    const job = (name: string) => async () => {
      running.push(name);
      await settle();
    };
    await Promise.all([
      queueForProject('one', job('one')),
      queueForProject('two', job('two')),
    ]);
    expect(running).toHaveLength(2);
  });

  it('returns the work’s own value and rejection', async () => {
    await expect(queueForProject('v', async () => 42)).resolves.toBe(42);
    await expect(
      queueForProject('v', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('a failed job does not wedge the queue behind it', async () => {
    const failing = queueForProject('w', async () => {
      throw new Error('nope');
    });
    await expect(failing).rejects.toThrow('nope');
    await expect(queueForProject('w', async () => 'ok')).resolves.toBe('ok');
  });

  it('forgets a project once its queue drains', async () => {
    await queueForProject('gone', async () => undefined);
    await settle();
    expect(busy('gone')).toBe(false);
  });

  it('reports busy while work is in flight', async () => {
    const inFlight = queueForProject('b', settle);
    expect(busy('b')).toBe(true);
    await inFlight;
  });
});
