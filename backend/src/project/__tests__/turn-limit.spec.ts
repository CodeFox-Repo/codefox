import { atTurnLimit, turnLimit, withUserTurn } from '../project-queue';

/**
 * The counter must come back down however a turn ends. A leaked slot is
 * worse than no limit: it locks the user out of their own account until the
 * process restarts, with no error to explain it.
 */
describe('per-user turn limit', () => {
  it('counts turns while they run and releases them after', async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));

    const running = withUserTurn('u1', () => held);
    expect(atTurnLimit('u1')).toBe(false); // 1 of 3

    release();
    await running;
    expect(atTurnLimit('u1')).toBe(false);
  });

  it('trips at the limit and clears once one finishes', async () => {
    const releases: Array<() => void> = [];
    const turns = Array.from({ length: turnLimit() }, () => {
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      releases.push(release);
      return withUserTurn('u2', () => held);
    });

    expect(atTurnLimit('u2')).toBe(true);

    releases[0]();
    await turns[0];
    expect(atTurnLimit('u2')).toBe(false);

    releases.slice(1).forEach((r) => r());
    await Promise.all(turns);
    expect(atTurnLimit('u2')).toBe(false);
  });

  it('releases the slot when the turn throws', async () => {
    await expect(
      withUserTurn('u3', async () => {
        throw new Error('bridge died');
      }),
    ).rejects.toThrow('bridge died');
    // Without the finally, this user would be permanently one slot poorer.
    expect(atTurnLimit('u3')).toBe(false);
  });

  it('counts each user separately', async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const turns = Array.from({ length: turnLimit() }, () =>
      withUserTurn('u4', () => held),
    );

    expect(atTurnLimit('u4')).toBe(true);
    expect(atTurnLimit('u5')).toBe(false);

    release();
    await Promise.all(turns);
  });
});
