import { lintArtifact, renderFindingsForAgent } from '../lint-artifact';

describe('lintArtifact', () => {
  it('flags a violet gradient as P0', () => {
    const findings = lintArtifact(
      `<style>.hero { background: linear-gradient(135deg, #7c3aed, #a855f7); }</style>`,
    );
    expect(findings).toContainEqual(
      expect.objectContaining({ severity: 'P0', id: 'purple-gradient' }),
    );
  });

  it('says nothing about a page that honours its tokens', () => {
    expect(
      lintArtifact(
        `<style>:root { --bg:#0d0d0f; --accent:#c96a3a; } .hero { background: var(--bg); }</style><h1>Kiln</h1>`,
      ),
    ).toEqual([]);
  });

  // The turn reads whatever index.html holds, including nothing at all.
  it('tolerates an empty or non-string body', () => {
    expect(lintArtifact('')).toEqual([]);
    expect(lintArtifact(null)).toEqual([]);
  });

  it('renders findings for the agent worst-first', () => {
    const rendered = renderFindingsForAgent(
      lintArtifact(`<style>.h { background: linear-gradient(90deg, violet, #fff); }</style>`),
    );
    expect(rendered).toContain('purple-gradient');
  });
});
