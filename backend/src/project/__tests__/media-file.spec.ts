import * as path from 'path';
import { staleMediaPath } from '../media-file';
import { getMediaDir } from '../../common/utils/common-path';

describe('staleMediaPath', () => {
  it('resolves the file when this row is its only user', () => {
    expect(staleMediaPath('/media/projects/p1/images/old.png', 1)).toBe(
      path.resolve(getMediaDir(), 'projects/p1/images/old.png'),
    );
  });

  it('keeps a file another row still points at', () => {
    // A fork inherits the source's photoUrl, and two users can hold the same
    // avatar url. Deleting it 404s the other one.
    expect(staleMediaPath('/media/projects/p1/images/shared.png', 2)).toBeNull();
  });

  it('has nothing to delete when there was no file', () => {
    expect(staleMediaPath(null, 0)).toBeNull();
    expect(staleMediaPath(undefined, 1)).toBeNull();
    expect(staleMediaPath('', 1)).toBeNull();
  });

  it('refuses to resolve outside the media directory', () => {
    // These urls are server-generated today, but this function's whole job is
    // deciding what gets unlinked — it must not depend on that staying true.
    expect(staleMediaPath('/media/../../etc/passwd', 1)).toBeNull();
    expect(staleMediaPath('/media/a/../../../secrets', 1)).toBeNull();
    expect(staleMediaPath('/etc/passwd', 1)).toBeNull();
    expect(staleMediaPath('https://example.com/media/x.png', 1)).toBeNull();
  });

  it('allows a name that merely contains dots', () => {
    expect(staleMediaPath('/media/projects/p1/a..b.png', 1)).toBe(
      path.resolve(getMediaDir(), 'projects/p1/a..b.png'),
    );
  });
});
