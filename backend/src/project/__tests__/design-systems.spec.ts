import {
  DESIGN_SYSTEMS,
  designSystem,
  designSystemChoices,
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
    for (const choice of designSystemChoices()) {
      expect(choice.bg).toMatch(/^(#|rgba)/);
      expect(choice.fg).toMatch(/^(#|rgba)/);
      expect(choice.accent).toMatch(/^(#|rgba)/);
    }
  });
});
