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

// ── Hang path 2: reconnect that never exhausts ──────────────────────────
// SandboxChannel's 30s budget restarts with every reconnectLoop, and a new
// loop starts on every socket drop — so a flapping socket never reaches
// finalizeClose and nothing terminal is ever emitted.
assert.ok(
  /if \(part\.type !== 'error'\) disarm\(\);/.test(src),
  'a non-error part no longer disarms — a recovered turn would be killed'
);
assert.ok(
  /transient: \$\{detail\}`\);[\s\S]{0,200}?disarm\(\);\s*\n\s*armed\(\);/.test(
    src
  ),
  'the Reconnecting branch no longer arms the guard — hang path 2 is back'
);
assert.ok(
  /finally \{\s*\n\s*disarm\(\);/.test(src),
  'the reconnect guard is not disarmed in finally'
);

// The guard must be armed ONLY by a reconnect: an ordinary long think has no
// deadline at all, which is what the reverted watchdog got wrong.
const step = async ({ arm, partAfterMs, deadlineMs }) => {
  let stalled;
  let timer;
  if (arm) {
    stalled = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('lost connection')), deadlineMs);
    });
    stalled.catch(() => {});
  }
  const next = new Promise((r) => setTimeout(() => r('part'), partAfterMs));
  try {
    return await (stalled ? Promise.race([next, stalled]) : next);
  } catch {
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
};

assert.equal(
  await step({ arm: false, partAfterMs: 40 }),
  'part',
  'an unarmed long think must never be interrupted'
);
assert.equal(
  await step({ arm: true, partAfterMs: 5, deadlineMs: 50 }),
  'part',
  'a reconnect that recovers must deliver its next part'
);
assert.equal(
  await step({ arm: true, partAfterMs: 60, deadlineMs: 5 }),
  'failed',
  'silence after a reconnect must fail the turn, not hang it'
);

console.log(
  'ok — endSession bounded, reconnect guard armed only post-reconnect'
);
