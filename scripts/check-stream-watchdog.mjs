import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('backend/src/chat/chat.controller.ts', 'utf8');

// The bug: `agent.stream()` drops the `done` promise the adapter rejects when
// the bridge dies, so a plain `for await` over result.stream never ends.
assert.ok(
  !/for await \(const part of result\.stream\)/.test(src),
  'back to a bare for-await — a dead bridge hangs the turn again'
);
assert.ok(
  src.includes('Promise.race([iterator.next(), silent])'),
  'the next part is no longer raced against the silence deadline'
);
assert.ok(
  /clearTimeout\(ticker\);\s*\n\s*silent = silence\(\);/.test(src),
  'the clock no longer restarts per part — a long turn would trip the watchdog'
);
assert.ok(
  /finally \{\s*\n\s*\/\/[^\n]*\n\s*clearTimeout\(ticker\)/.test(src),
  'the timer is not cleared in finally — a finished turn keeps the process awake'
);

// The race, as the loop runs it. A rejected deadline must reach the catch;
// a part must not.
const race = async (partDelay, deadlineMs) => {
  const next = new Promise((r) =>
    setTimeout(() => r({ done: false }), partDelay)
  );
  const silent = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('went away')), deadlineMs)
  );
  silent.catch(() => {}); // the loser rejects; don't trip unhandled-rejection
  return Promise.race([next, silent]);
};

assert.deepEqual(
  await race(5, 60),
  { done: false },
  'a part must win a live turn'
);
await assert.rejects(
  race(60, 5),
  /went away/,
  'silence past the deadline must throw'
);

console.log('ok — watchdog wired, restarts per part, cleared on exit');
