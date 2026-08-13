import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('backend/src/chat/chat.controller.ts', 'utf8');

// The hang was never the stream — it was endSession(). On a bridge that died
// mid-turn the harness leaves turnState !== 'idle', so session.stop() goes
// through doSuspendTurn(), a request/response to a dead process with no
// timeout of its own. The finally awaited it, so res.end() was never reached.
assert.ok(
  /Promise\.race\(\[\s*abandoned \? session\.destroy\?\.\(\) : session\.stop\?\.\(\)/.test(
    src
  ),
  'endSession no longer bounds stop/destroy — a dead bridge hangs the turn again'
);
assert.ok(
  /clearTimeout\(timer\)/.test(src),
  'the endSession timer is not cleared — a finished turn keeps the process awake'
);

// Both exits route through endSession: the normal finally and the
// res.on('close') abandon path. One definition + two call sites.
assert.equal(
  src.match(/(?<!const )endSession\(/g).length,
  2,
  'expected two call sites (finally, close handler)'
);

// The race, as endSession runs it: a hung stop must not block, a live one wins.
const endSession = async (stopMs, timeoutMs) => {
  let timer;
  try {
    await Promise.race([
      new Promise((r) => setTimeout(r, stopMs)),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('stop timed out')),
          timeoutMs
        );
      }),
    ]);
    return 'stopped';
  } catch {
    return 'timed out'; // the real catch only logs, so the finally proceeds
  } finally {
    clearTimeout(timer);
  }
};

assert.equal(await endSession(5, 60), 'stopped', 'a live stop must win');
assert.equal(
  await endSession(60, 5),
  'timed out',
  'a hung stop must not block res.end()'
);

console.log('ok — endSession bounded, both exits covered, timer cleared');
