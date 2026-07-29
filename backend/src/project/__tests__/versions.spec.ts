import { parseVersionLog, VERSION_LOG_FORMAT } from '../workspace';

const SEP = '\x1f';
const line = (sha: string, at: string, subject: string) =>
  [sha, at, subject].join(SEP);

describe('parseVersionLog', () => {
  const head = 'aaa111';

  it('reads sha, time and label, newest first as git gives them', () => {
    const out = [
      line('aaa111', '2026-07-29T00:10:00Z', 'now say version two'),
      line('bbb222', '2026-07-29T00:05:00Z', 'make it say version one'),
      line('ccc333', '2026-07-29T00:00:00Z', 'starter baseline'),
    ].join('\n');

    expect(parseVersionLog(out, head)).toEqual([
      {
        id: 'aaa111',
        at: '2026-07-29T00:10:00Z',
        label: 'now say version two',
        current: true,
      },
      {
        id: 'bbb222',
        at: '2026-07-29T00:05:00Z',
        label: 'make it say version one',
        current: false,
      },
      {
        id: 'ccc333',
        at: '2026-07-29T00:00:00Z',
        label: 'starter baseline',
        current: false,
      },
    ]);
  });

  it('marks the current version even when git pads HEAD with a newline', () => {
    const versions = parseVersionLog(
      line('aaa111', '2026-07-29T00:10:00Z', 'a turn'),
      'aaa111\n',
    );
    expect(versions[0].current).toBe(true);
  });

  it('keeps a label that contains the field separator', () => {
    // A prompt is the label, and a prompt can contain anything.
    const versions = parseVersionLog(
      line('aaa111', '2026-07-29T00:10:00Z', `make it${SEP}pop`),
      head,
    );
    expect(versions[0].label).toBe(`make it${SEP}pop`);
  });

  it('survives blank and malformed lines rather than inventing versions', () => {
    const versions = parseVersionLog(
      ['', line('aaa111', '2026-07-29T00:10:00Z', 'real'), 'garbage', ''].join(
        '\n',
      ),
      head,
    );
    expect(versions).toHaveLength(1);
    expect(versions[0].id).toBe('aaa111');
  });

  it('falls back to a label rather than showing an empty row', () => {
    const versions = parseVersionLog(
      line('aaa111', '2026-07-29T00:10:00Z', '   '),
      head,
    );
    expect(versions[0].label).toBe('Snapshot');
  });

  it('asks git for exactly the three fields it parses', () => {
    // The format and the parser have to agree; a field added to one alone
    // shifts every column silently.
    expect(VERSION_LOG_FORMAT.split(SEP)).toHaveLength(3);
  });
});
