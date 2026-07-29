import { staleCoverPath } from '../cover';

describe('staleCoverPath', () => {
  it('resolves the file when this project is its only user', () => {
    const p = staleCoverPath('/media/projects/p1/images/old.png', 1);
    expect(p).toContain('projects/p1/images/old.png');
    expect(p).not.toContain('/media/media/');
  });

  it('keeps a cover a fork still points at', () => {
    // The fork inherited photoUrl; deleting the file would 404 its card and
    // drop it off the gallery, which requires a cover.
    expect(staleCoverPath('/media/projects/p1/images/shared.png', 2)).toBeNull();
  });

  it('has nothing to delete when there was no cover', () => {
    expect(staleCoverPath(null, 0)).toBeNull();
    expect(staleCoverPath(undefined, 1)).toBeNull();
    expect(staleCoverPath('', 1)).toBeNull();
  });
});
