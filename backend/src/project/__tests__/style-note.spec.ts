import { noteStyle } from '../style-note';

/**
 * The one thing that must hold: trying five styles leaves ONE line, not five.
 * NOTES.md rides into every prompt, so an append-only log of every style the
 * user clicked would crowd out the decisions that still matter.
 */
describe('noteStyle', () => {
  it('creates the file shape the instructions describe', () => {
    expect(noteStyle(null, 'Luxury')).toBe('# Notes\n- Design system: Luxury\n');
    expect(noteStyle('   ', 'Neon')).toBe('# Notes\n- Design system: Neon\n');
  });

  it('replaces its own line instead of appending', () => {
    let notes = noteStyle(null, 'Editorial');
    for (const style of ['Brutalist', 'Neon', 'Glass', 'Luxury']) {
      notes = noteStyle(notes, style);
    }
    expect(notes.match(/Design system:/g)).toHaveLength(1);
    expect(notes).toContain('- Design system: Luxury');
    expect(notes).not.toContain('Editorial');
  });

  it('keeps every other decision the agent recorded', () => {
    const existing = [
      '# Notes',
      '- Audience: solo founders evaluating on a phone',
      '- Design system: Editorial',
      '- No pricing section until they have real numbers',
    ].join('\n');

    const next = noteStyle(existing, 'Brutalist');
    expect(next).toContain('- Audience: solo founders evaluating on a phone');
    expect(next).toContain('- No pricing section until they have real numbers');
    expect(next).toContain('- Design system: Brutalist');
    // Position is preserved, so the agent's own ordering is not reshuffled.
    expect(next.indexOf('Audience')).toBeLessThan(
      next.indexOf('Design system'),
    );
  });

  it('appends when the project has notes but no style line yet', () => {
    const existing = '# Notes\n- Brand accent stays #c96a3a';
    const next = noteStyle(existing, 'Minimal');
    expect(next).toContain('- Brand accent stays #c96a3a');
    expect(next).toContain('- Design system: Minimal');
    expect(next.match(/Design system:/g)).toHaveLength(1);
  });

  it('recognises the line after the agent has reworded its case', () => {
    // The agent maintains this file too; it may rewrite the line in its own
    // voice. Matching case-insensitively is what stops a second one appearing.
    const existing = '# Notes\n- design system: Neon (user picked this)';
    const next = noteStyle(existing, 'Glass');
    expect(next.match(/design system:/gi)).toHaveLength(1);
    expect(next).toContain('- Design system: Glass');
  });
});
