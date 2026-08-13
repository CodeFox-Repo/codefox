import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('frontend/src/hooks/useChatStream.ts', 'utf8');
assert.ok(
  /const answer = text\(splitTurn\(steps\)\.answer\) \|\| \(died \? text\(steps\) : ''\)/.test(
    src
  ),
  'a dead turn no longer falls back to its streamed text — the partial answer is lost again'
);
assert.ok(
  /died = true;/.test(src),
  'onError no longer records that the turn died'
);

// splitTurn, verbatim from const/MessageType.ts.
const splitTurn = (steps) => {
  let cut = steps.length;
  while (cut > 0 && steps[cut - 1].kind === 'text') cut--;
  return { work: steps.slice(0, cut), answer: steps.slice(cut) };
};
const text = (parts) =>
  parts
    .map((s) => (s.kind === 'text' ? s.text : ''))
    .join('')
    .trim();
const saved = (steps, died) =>
  text(splitTurn(steps).answer) || (died ? text(steps) : '');

// The r4 shape: text, then a tool, then the runtime dies.
const dead = [
  { kind: 'text', text: 'Beginning the audit now.' },
  { kind: 'tool', tool: 'bash' },
];
assert.equal(
  saved(dead, true),
  'Beginning the audit now.',
  'bridge death must keep the text the user already read'
);
assert.equal(
  saved(dead, false),
  '',
  'an abort mid-tool is still no answer — the user will ask again'
);

// A normal turn is unaffected: only the closing summary is kept, not the notes.
const normal = [
  { kind: 'text', text: 'Let me look.' },
  { kind: 'tool', tool: 'bash' },
  { kind: 'text', text: 'Done — added a hero.' },
];
assert.equal(saved(normal, false), 'Done — added a hero.');
assert.equal(
  saved(normal, true),
  'Done — added a hero.',
  'a died flag must not widen a turn that has a real answer'
);
assert.equal(
  saved([{ kind: 'tool', tool: 'bash' }], true),
  '',
  'no text, no save'
);

console.log('ok — dead turns keep their partial text, live turns unchanged');
