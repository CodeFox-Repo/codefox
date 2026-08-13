import { SCENARIOS, scenario, scenarioChoices } from '../scenarios';

/**
 * The scenario is what the user actually answers, and it decides two things
 * that used to be one dropdown: which workspace gets scaffolded, and what
 * shape the agent is told to build.
 */
describe('scenarios', () => {
  it('maps every scenario to a real workspace kind', () => {
    for (const s of SCENARIOS) {
      expect(['html', 'next']).toContain(s.template);
      expect(s.name).toBeTruthy();
      expect(s.blurb).toBeTruthy();
    }
  });

  it('gives every page scenario shape guidance, and the app none', () => {
    // The Next starter has its own conventions; the html kinds are the ones
    // that would otherwise all come out as a centered hero.
    for (const s of SCENARIOS) {
      if (s.template === 'html') expect(s.guidance.length).toBeGreaterThan(200);
      else expect(s.guidance).toBe('');
    }
  });

  it('falls back to a real scenario for unknown or missing ids', () => {
    expect(scenario('no-such-thing').id).toBe('landing');
    expect(scenario(null).id).toBe('landing');
    expect(scenario(undefined).id).toBe('landing');
    expect(scenario('deck').id).toBe('deck');
  });

  it('keeps the guidance server-side', () => {
    // It is prompt text, and shipping it would double every page load for a
    // string the browser never renders.
    for (const choice of scenarioChoices()) {
      expect(choice).not.toHaveProperty('guidance');
      expect(choice).not.toHaveProperty('template');
    }
  });

  it('has unique ids', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Which scenario a project is lives in the page, not a column — so the tag
  // the scaffold writes and the pattern the turn reads back have to agree.
  // They sit in different files and would drift silently.
  it('round-trips through the meta tag the scaffold writes', () => {
    const written = (id: string) =>
      `<meta name="codefox-scenario" content="${id}" />`;
    const read = /name="codefox-scenario"\s+content="([\w-]+)"/;
    for (const s of SCENARIOS) {
      expect(written(s.id).match(read)?.[1]).toBe(s.id);
    }
    // A page scaffolded before scenarios existed reads as nothing at all.
    expect('<head><title>x</title></head>'.match(read)?.[1] ?? null).toBeNull();
  });

  it("does not tell a deck to use scrollIntoView", () => {
    // The lint flags it P0 — it yanks the host page across an iframe
    // boundary — so the guidance must not be what puts it there.
    for (const s of SCENARIOS) {
      expect(s.guidance).not.toMatch(/\bscrollIntoView\s*\(/);
    }
  });
});
