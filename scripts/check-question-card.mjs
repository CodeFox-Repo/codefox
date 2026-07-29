#!/usr/bin/env node
/**
 * The planner's question block is written by a model, so its shape is a
 * suggestion rather than a contract. This checks the parser survives what a
 * model plausibly emits.
 *
 * A script rather than a test suite: the frontend has no test runner, and
 * standing one up for one pure function is more machinery than the function.
 * Run it directly — `node scripts/check-question-card.mjs`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The parser lives in a .tsx module, so read it and lift the two pieces that
// matter rather than pull a TypeScript toolchain into a check script.
const source = readFileSync(
  new URL('../frontend/src/components/chat/question-card.tsx', import.meta.url),
  'utf8',
);

const FENCE = /```codefox-questions\s*\n([\s\S]*?)```/;
assert.ok(
  source.includes('const FENCE = /```codefox-questions'),
  'the component no longer declares FENCE — this check is out of date',
);
assert.ok(
  source.includes('`q${index}`'),
  'the id fallback is gone: two questions can share an answer slot again',
);

/** Mirrors extractQuestions, which is what the component runs. */
function extract(content) {
  const match = content?.match(FENCE);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    const seen = new Set();
    const questions = (
      Array.isArray(parsed?.questions)
        ? parsed.questions.filter(
            (q) =>
              q &&
              typeof q.label === 'string' &&
              Array.isArray(q.options) &&
              q.options.length > 0,
          )
        : []
    ).map((q, index) => {
      const id =
        typeof q.id === 'string' && q.id && !seen.has(q.id) ? q.id : `q${index}`;
      seen.add(id);
      return { ...q, id };
    });
    return questions.length ? questions : null;
  } catch {
    return null;
  }
}

const block = (value) =>
  '```codefox-questions\n' + JSON.stringify(value) + '\n```';

const two = (a, b) => ({
  questions: [
    { ...a, label: 'first', options: ['A', 'B'] },
    { ...b, label: 'second', options: ['C', 'D'] },
  ],
});

/** Answering the first question must not answer the second. */
function isolated(shape, name) {
  const questions = extract(block(shape));
  assert.ok(questions, `${name}: no questions parsed`);
  const ids = questions.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length, `${name}: ids collide (${ids})`);
  const choices = { [questions[0].id]: ['A'] };
  for (const q of questions.slice(1)) {
    assert.ok(!choices[q.id], `${name}: answering one answered another`);
  }
}

isolated(two({}, {}), 'no ids at all');
isolated(two({ id: 'x' }, { id: 'x' }), 'duplicate ids');
isolated(two({ id: '' }, { id: '' }), 'empty-string ids');
isolated(two({ id: 1 }, { id: 2 }), 'numeric ids');
isolated(two({ id: 'style' }, { id: 'tone' }), 'proper ids');

// Ids the model did supply are kept — they are what the answer text is
// composed from.
assert.deepEqual(
  extract(block(two({ id: 'style' }, { id: 'tone' }))).map((q) => q.id),
  ['style', 'tone'],
  'good ids were replaced',
);

// Shapes that must not render as a card at all.
assert.equal(extract('no fence here'), null, 'matched without a fence');
assert.equal(
  extract('```codefox-questions\n{ not json\n```'),
  null,
  'malformed JSON produced a card',
);
assert.equal(
  extract(block({ questions: [{ label: 'no options', options: [] }] })),
  null,
  'a question with no options produced a card',
);
// Half-streamed: the closing fence has not arrived yet.
assert.equal(
  extract('```codefox-questions\n{"questions":[]'),
  null,
  'an unclosed block produced a card',
);

console.log('ok — question card parser survives 9 model-written shapes');
