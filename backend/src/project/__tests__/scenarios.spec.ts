import {
  SCENARIOS,
  scenario,
  scenarioChoices,
  scenarioMeta,
  scenarioOfPage,
} from '../scenarios';

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

  it('gives every scenario guidance to build from', () => {
    // The html kinds need shape guidance — otherwise they all come out as a
    // centered hero. The app kind needs to know what the starter ships: it
    // grew a database helper, and a model that does not know it is there
    // reinvents state badly.
    for (const s of SCENARIOS) {
      if (s.template === 'html') expect(s.guidance.length).toBeGreaterThan(200);
      else expect(s.guidance).toContain('@/lib/db');
    }
  });

  it('answers undefined for unknown or missing ids — no default shape', () => {
    // The old fallback to SCENARIOS[0] injected landing guidance into every
    // unpicked project: a collaborative editor came out as a marketing page.
    expect(scenario('no-such-thing')).toBeUndefined();
    expect(scenario(null)).toBeUndefined();
    expect(scenario(undefined)).toBeUndefined();
    expect(scenario('deck')?.id).toBe('deck');
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
    // Both sides imported, not re-declared: re-typing the tag and the regex
    // here would assert this file against itself and pass no matter how far
    // scaffold.ts and chat.controller.ts drifted apart.
    for (const s of SCENARIOS) {
      expect(scenarioOfPage(scenarioMeta(s.id))).toBe(s.id);
    }
    // A page scaffolded before scenarios existed reads as nothing at all.
    expect(scenarioOfPage('<head><title>x</title></head>')).toBeNull();
    expect(scenarioOfPage(null)).toBeNull();
    // And the tag survives being embedded in a real <head>.
    const head = `<head><meta charset="utf-8" />${scenarioMeta('deck')}<title>x</title></head>`;
    expect(scenarioOfPage(head)).toBe('deck');
  });

  it("does not tell a deck to use scrollIntoView", () => {
    // The lint flags it P0 — it yanks the host page across an iframe
    // boundary — so the guidance must not be what puts it there.
    for (const s of SCENARIOS) {
      expect(s.guidance).not.toMatch(/\bscrollIntoView\s*\(/);
    }
  });

  it('gives every page scenario enough guidance to build from', () => {
    // The bar is not "has a string" — a one-line scenario produces the
    // centered hero this table exists to prevent.
    for (const s of SCENARIOS.filter((x) => x.template === 'html')) {
      expect(s.guidance.length).toBeGreaterThan(600);
    }
  });

  it('says how each kind of page fails, rather than listing its regions', () => {
    // Guidance used to prescribe regions in order, which prevented the
    // centered hero by replacing it with a different identical page: every
    // landing page came out with the same six blocks. What a scenario should
    // carry is what this kind of page must accomplish and how it
    // characteristically fails — the layout is a judgement about the brief.
    for (const s of SCENARIOS.filter((x) => x.template === 'html')) {
      expect(s.guidance).toMatch(/fails|failure/i);
      expect(s.guidance).not.toMatch(/^Regions[,:]/m);
    }
  });

  it('has unique ids and names', () => {
    // The id lands in a meta tag and the name in a picker; a duplicate makes
    // one of them unreachable.
    const ids = SCENARIOS.map((s) => s.id);
    const names = SCENARIOS.map((s) => s.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('round-trips every id through the meta tag', () => {
    // scaffold writes it, every turn reads it back. An id the regex cannot
    // match silently degrades that project to the default scenario forever.
    for (const s of SCENARIOS) {
      expect(scenarioOfPage(scenarioMeta(s.id))).toBe(s.id);
    }
  });
});
