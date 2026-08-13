import {
  DESIGN_SYSTEMS,
  designSystem,
  designSystemChoices,
  swapTokens,
} from '../design-systems';

/**
 * The contract this feature rests on: every system binds the same variables,
 * so a page written against them survives a restyle — and an unknown id gets
 * a style rather than the styleless default the feature exists to avoid.
 */
describe('design systems', () => {
  const CONTRACT = [
    '--bg',
    '--surface',
    '--fg',
    '--muted',
    '--border',
    '--accent',
    '--accent-on',
    '--font-display',
    '--font-body',
    '--text-3xl',
    '--radius-md',
    '--section-y',
  ];

  it('binds the whole token contract in every system', () => {
    const missing = DESIGN_SYSTEMS.flatMap((system) =>
      CONTRACT.filter((name) => !system.tokens.includes(`${name}:`)).map(
        (name) => `${system.id}${name}`,
      ),
    );
    expect(missing).toEqual([]);
  });

  it('has unique ids', () => {
    const ids = DESIGN_SYSTEMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('falls back to a real system for unknown or missing ids', () => {
    expect(designSystem('no-such-style').id).toBe(DESIGN_SYSTEMS[0].id);
    expect(designSystem(null).id).toBe(DESIGN_SYSTEMS[0].id);
    expect(designSystem(undefined).id).toBe(DESIGN_SYSTEMS[0].id);
    expect(designSystem('neon').id).toBe('neon');
  });

  it('exposes parsed swatch colors, not empty strings', () => {
    // The picker renders these directly as CSS; a failed parse would show
    // as a transparent swatch and nobody would notice in a type check.
    // The imported catalog uses oklch() and rgb() alongside hex, so this
    // asserts a literal color of some form — specifically not a var()
    // reference, which resolves to nothing outside the page it came from.
    for (const choice of designSystemChoices()) {
      for (const value of [choice.bg, choice.fg, choice.accent]) {
        expect(value).toMatch(/^(#|rgba?\(|oklch\(|hsla?\()/);
      }
    }
  });

  it('groups every system under a category for the picker', () => {
    for (const system of DESIGN_SYSTEMS) {
      expect(system.category).toBeTruthy();
      expect(system.blurb).toBeTruthy();
    }
  });
});

/**
 * Restyling is a token swap: the page's own markup reads var(--*) throughout,
 * so replacing the :root body is the whole feature. What matters is that it
 * finds the block, leaves the rest of the file alone, and says so honestly
 * when the agent has restructured the styles away.
 */
describe('swapTokens', () => {
  const page = `<html><head><style>
      :root {
        --bg: #fff;
        --accent: #000;
      }
      body { background: var(--bg); }
    </style></head><body><h1>Hi</h1></body></html>`;

  it('replaces the token block and nothing else', () => {
    const out = swapTokens(page, '  --bg: #101010;\n  --accent: #ff0;');
    expect(out).toContain('--bg: #101010;');
    expect(out).not.toContain('--bg: #fff;');
    // The rules that consume the tokens, and the markup, are untouched.
    expect(out).toContain('body { background: var(--bg); }');
    expect(out).toContain('<h1>Hi</h1>');
  });

  it('produces a page whose :root holds exactly the new values', () => {
    const out = swapTokens(page, '  --bg: #101010;\n  --accent: #ff0;');
    expect(/:root\s*\{([^}]*)\}/.exec(out)[1]).toMatch(
      /--bg: #101010;\s*--accent: #ff0;/,
    );
  });

  it('returns null when there is no :root to swap', () => {
    expect(swapTokens('<html><body>no styles</body></html>', '--bg: #000;')).toBeNull();
  });

  it('restyles a real system into the starter shape', () => {
    const out = swapTokens(page, designSystem('airbnb').tokens);
    expect(out).toContain('--accent: #ff385c;');
    expect(out).toContain('--section-y:');
  });

  it('is idempotent — restyling twice to the same system is a no-op', () => {
    const once = swapTokens(page, designSystem('airbnb').tokens);
    expect(swapTokens(once, designSystem('airbnb').tokens)).toBe(once);
  });

  it('rewrites only the first :root, leaving a later one alone', () => {
    // A page that grew a second token block keeps it: guessing which one is
    // "the design" would be how a restyle silently breaks a dark-mode scope.
    const twoBlocks = `${page}<style>:root { --late: 1px; }</style>`;
    const out = swapTokens(twoBlocks, '  --bg: #101010;');
    expect(out).toContain('--late: 1px;');
    expect(out).toContain('--bg: #101010;');
  });
});

/**
 * The catalog is generated from open-design, but codefox's own eight systems
 * were edited locally after they were first copied over. A re-import must not
 * quietly revert those edits, and must not drop the ones with no upstream
 * counterpart at all.
 */
describe('local systems survive the import', () => {
  const ORIGINAL_EIGHT = [
    'editorial',
    'product',
    'minimal',
    'brutalist',
    'luxury',
    'neon',
    'glass',
    'retro',
  ];

  it('keeps all eight, in front, with editorial still the fallback', () => {
    expect(DESIGN_SYSTEMS.slice(0, 8).map((s) => s.id)).toEqual(ORIGINAL_EIGHT);
    // designSystem() falls back to the first row, so this pins the default
    // style a project scaffolds with when no id is given.
    expect(designSystem(null).id).toBe('editorial');
  });

  it('keeps the locally-edited values, not the upstream ones', () => {
    // minimal diverged from upstream in 8 of its 34 tokens; this is one of
    // them, and it flipping means a re-import clobbered the local edit.
    expect(designSystem('minimal').tokens).toContain('--accent: #111111;');
  });
});
