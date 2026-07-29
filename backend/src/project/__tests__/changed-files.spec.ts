import { mergeChanges, parseNameStatus, parsePorcelain } from '../workspace';

describe('parseNameStatus', () => {
  it('reads git diff --name-status letters', () => {
    expect(
      parseNameStatus(
        ['A\tsrc/new.tsx', 'M\tindex.html', 'D\tsrc/gone.tsx'].join('\n'),
      ),
    ).toEqual([
      { path: 'src/new.tsx', status: 'added' },
      { path: 'index.html', status: 'modified' },
      { path: 'src/gone.tsx', status: 'deleted' },
    ]);
  });

  it('reports the new path of a rename, which is the one to open', () => {
    expect(parseNameStatus('R100\tsrc/old.tsx\tsrc/new.tsx')).toEqual([
      { path: 'src/new.tsx', status: 'added' },
    ]);
  });

  it('leaves agent scratch and shared deps out', () => {
    expect(
      parseNameStatus(
        ['M\tnode_modules/x/index.js', 'A\t.agent-runs/1/log', 'M\tapp.tsx'].join(
          '\n',
        ),
      ),
    ).toEqual([{ path: 'app.tsx', status: 'modified' }]);
  });

  it('ignores blank and malformed lines', () => {
    expect(parseNameStatus(['', 'nonsense', 'M\tok.ts', ''].join('\n'))).toEqual(
      [{ path: 'ok.ts', status: 'modified' }],
    );
  });
});

describe('mergeChanges', () => {
  it('unions both views, one entry per path', () => {
    const merged = mergeChanges(
      [{ path: 'index.html', status: 'modified' }],
      [{ path: 'notes.md', status: 'added' }],
    );
    expect(merged).toEqual([
      { path: 'index.html', status: 'modified' },
      { path: 'notes.md', status: 'added' },
    ]);
  });

  it('keeps "added" for a file the agent created and then edited again', () => {
    // Against the starter it is still a new file, which is what the panel
    // is answering — the working tree only knows it differs from HEAD.
    expect(
      mergeChanges(
        [{ path: 'about.html', status: 'added' }],
        [{ path: 'about.html', status: 'modified' }],
      ),
    ).toEqual([{ path: 'about.html', status: 'added' }]);
  });

  it('lets the working tree report a committed file as deleted', () => {
    expect(
      mergeChanges(
        [{ path: 'gone.html', status: 'added' }],
        [{ path: 'gone.html', status: 'deleted' }],
      ),
    ).toEqual([{ path: 'gone.html', status: 'deleted' }]);
  });

  it('composes with the porcelain parser the working view actually uses', () => {
    const merged = mergeChanges(
      parseNameStatus('M\tindex.html'),
      parsePorcelain('?? notes.md'),
    );
    expect(merged.map((c) => `${c.status} ${c.path}`)).toEqual([
      'modified index.html',
      'added notes.md',
    ]);
  });
});
