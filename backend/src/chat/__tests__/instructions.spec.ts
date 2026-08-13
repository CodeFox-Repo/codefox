import { instructionsFor, notesNote } from '../instructions';
import { DESIGN_SYSTEMS } from '../../project/design-systems';

/**
 * E2E caught the agent emitting {"id":"style", options:["clean","sleek"]} —
 * free text, no `kind`, no catalog ids, so the palette cards never rendered.
 * The rules were present but stated as prose BEFORE the plan section, which
 * ships its own concrete `"id":"style"` example with free-text options. A
 * model follows the nearest example, so it followed that one.
 */
describe('assembled html instructions', () => {
  const prompt = instructionsFor('html', 'landing');

  it('ships a concrete style example, not just prose about one', () => {
    expect(prompt).toContain('"kind":"style"');
    expect(prompt).toContain('"options":["editorial","brutalist","neon","cal"]');
  });

  it('puts the style example AFTER the plain-question example', () => {
    // The whole bug: a competing example later in the prompt wins.
    const plain = prompt.indexOf('"label":"Question text"');
    const style = prompt.indexOf('"kind":"style"');
    expect(plain).toBeGreaterThan(-1);
    expect(style).toBeGreaterThan(plain);
  });

  it('uses ids the catalog actually has', () => {
    // An id that does not resolve is dropped silently by the card, which is
    // indistinguishable from the agent ignoring the instruction.
    for (const id of ['editorial', 'brutalist', 'neon', 'cal']) {
      expect(DESIGN_SYSTEMS.some((s) => s.id === id)).toBe(true);
    }
  });

  it('says in words that free text is not an option', () => {
    expect(prompt).toMatch(/not valid options/i);
  });

  it('leaves Next projects alone', () => {
    expect(instructionsFor('next', null)).not.toContain('"kind":"style"');
  });
});

/**
 * The replay window is 20 turns. NOTES.md is the only thing that outlives it,
 * so both kinds have to be told to keep it — a Next project forgets its
 * constraints exactly as fast as a page does.
 */
describe('project memory instruction', () => {
  it('tells both kinds to maintain NOTES.md', () => {
    expect(instructionsFor('html', 'landing')).toContain('NOTES.md');
    expect(instructionsFor('next', null)).toContain('NOTES.md');
  });

  it('says what NOT to write, or it fills with a changelog git already has', () => {
    expect(instructionsFor('html', 'landing')).toMatch(/not log what you did/i);
  });
});

describe('notesNote', () => {
  it('labels the notes so they read as decisions, not as the user talking', () => {
    const out = notesNote('- audience: solo founders');
    expect(out).toContain('NOTES.md');
    expect(out).toContain('- audience: solo founders');
    // Separated from the replayed turns that follow it.
    expect(out.endsWith('---\n\n')).toBe(true);
  });

  it('adds nothing when there are no notes', () => {
    // A project without NOTES.md must not get an empty "already decided"
    // header — that reads as "we decided nothing".
    expect(notesNote(null)).toBe('');
    expect(notesNote(undefined)).toBe('');
    expect(notesNote('   \n  ')).toBe('');
  });
});
