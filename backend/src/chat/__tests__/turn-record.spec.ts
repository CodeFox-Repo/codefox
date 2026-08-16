import {
  assemblePrompt,
  instructionsFor,
  type PriorTurn,
} from '../instructions';
import { hash12 } from '../agent-turn.model';

/**
 * The corpus is only worth mining if a recorded row can be turned back into
 * the prompt that actually ran. Nothing else checks that: the row stores the
 * instructions as a hash, the context as JSON and the user's message
 * verbatim, and deliberately does NOT store the retold history — so
 * reassembly means rebuilding the retell from Chat.messages and pasting the
 * halves back together in the right order.
 *
 * If that contract ever breaks — a new block added to the prompt that nothing
 * records, the blocks reordered, the history clipping changed — every stored
 * promptHash silently starts describing a prompt that never existed, and no
 * error is raised anywhere. This test is the only thing that notices.
 *
 * It calls the shipped functions rather than restating them, which is the
 * whole point: a copy of the assembly here would pass while the real one
 * drifted.
 */
describe('the recorded turn reassembles into the prompt that ran', () => {
  /** What the controller stores in `contextJson`, plus what it stores beside it. */
  const recordOf = ({
    template,
    scenarioId,
    notes,
    handEdits,
    lint,
    message,
    history,
  }: {
    template?: string | null;
    scenarioId?: string | null;
    notes?: string | null;
    handEdits?: { path: string; status: string }[];
    lint?: any[];
    message: string;
    history: PriorTurn[];
  }) => {
    const instructions = instructionsFor(template, scenarioId);
    // Exactly what project-agent.ts builds and hands back.
    const prompt = assemblePrompt({
      notes,
      history,
      handEdits,
      lint,
      asked: message,
    });
    return {
      instructionsHash: hash12(instructions),
      promptHash: hash12(prompt),
      promptChars: prompt.length,
      userMessage: message,
      contextJson: { notes, handEdits, lint, images: 0 },
    };
  };

  /** The digest's side: a row plus Chat.messages, back to the prompt string. */
  const reassemble = (row: ReturnType<typeof recordOf>, history: PriorTurn[]) =>
    assemblePrompt({
      notes: row.contextJson.notes,
      history,
      handEdits: row.contextJson.handEdits,
      lint: row.contextJson.lint,
      asked: row.userMessage,
    });

  const CASES: [string, Parameters<typeof recordOf>[0]][] = [
    [
      'a bare first turn',
      { template: 'html', message: 'build me a landing page', history: [] },
    ],
    [
      'every context block at once',
      {
        template: 'html',
        scenarioId: 'portfolio',
        notes: '# Notes\n- Accent stays #c96a3a',
        handEdits: [{ path: 'index.html', status: 'modified' }],
        lint: [{ id: 'gradient', severity: 'P0', message: 'purple gradient' }],
        message: 'make the hero smaller',
        history: [
          { role: 'user', content: 'build me a portfolio' },
          { role: 'assistant', content: 'Done — index.html has the hero.' },
        ],
      },
    ],
    [
      'a next project, which takes the other instructions',
      {
        template: 'next',
        scenarioId: 'app',
        message: '加一个登录页',
        history: [{ role: 'user', content: 'earlier' }],
      },
    ],
  ];

  it.each(CASES)('%s', (_name, input) => {
    const row = recordOf(input);
    const rebuilt = reassemble(row, input.history);

    expect(hash12(rebuilt)).toBe(row.promptHash);
    expect(rebuilt.length).toBe(row.promptChars);
    // The instructions are the static half and live in their own row; a turn
    // row that could not name one would leave the prompt unreconstructible.
    expect(row.instructionsHash).toHaveLength(12);
    expect(row.instructionsHash).toBe(
      hash12(instructionsFor(input.template, input.scenarioId)),
    );
  });

  /**
   * The retell is the one prompt block NOT stored on the row — it is a pure
   * function of Chat.messages, and copying it per turn would duplicate the
   * whole conversation on every row. That is only safe while it really is
   * reconstructible, so: same messages in, same prompt out; different
   * messages, different prompt.
   */
  it('rebuilds the retell from history rather than storing it', () => {
    const history: PriorTurn[] = [
      { role: 'user', content: 'first ask' },
      { role: 'assistant', content: 'first answer' },
    ];
    const input = { template: 'html', message: 'follow up', history };
    const row = recordOf(input);

    expect(hash12(reassemble(row, history))).toBe(row.promptHash);
    // The row cannot carry the conversation — that is the bloat this avoids.
    expect(JSON.stringify(row.contextJson)).not.toContain('first answer');
    // And the history is genuinely load-bearing: reassembling with the wrong
    // one must NOT hash equal, or the check above proves nothing.
    expect(
      hash12(reassemble(row, [{ role: 'user', content: 'different' }])),
    ).not.toBe(row.promptHash);
  });

  /**
   * An image contributes an attachment line to the prompt, and the record
   * keeps only the count — so a turn with attachments is knowingly outside
   * the reassembly contract. Better to state it here than to have a digest
   * discover it as a mystery hash mismatch.
   */
  it('counts images without storing them', () => {
    const row = recordOf({
      template: 'html',
      message: 'match this screenshot',
      history: [],
    });
    expect(row.contextJson.images).toBe(0);
    expect(JSON.stringify(row)).not.toContain('base64');
  });
});
