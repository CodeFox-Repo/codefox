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
// A bridge that closes with no reconnect frame arms nothing and its rejection
// is swallowed by the discarded `done` promise, so the loop needs a deadline
// running from the start of the turn, not only after a Reconnecting frame.
assert.ok(
  /armed\(IDLE_MS\);\s*\n\s*try \{/.test(src),
  'the turn no longer arms an idle deadline at stream start — a silent close hangs again'
);
assert.ok(
  /const next = await Promise\.race\(\[iterator\.next\(\), stalled!\]\);/.test(
    src
  ),
  'the read is no longer always raced — an unarmed read can block forever'
);
assert.ok(
  /if \(part\.type !== 'error'\) \{\s*\n\s*disarm\(\);\s*\n\s*armed\(IDLE_MS\);/.test(
    src
  ),
  'a live part no longer re-arms the idle deadline'
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

// Two deadlines, one timer: the loose one runs all turn, the tight one takes
// over once a reconnect has made the stream suspect.
assert.match(
  src,
  /const IDLE_MS = 5 \* 60_000;/,
  'the unconditional idle deadline changed — 5min silence is the agreed backstop'
);
assert.match(
  src,
  /const RECONNECT_SILENCE_MS = 90_000;/,
  'the post-reconnect deadline changed — 90s is the agreed tighter arm'
);
// One `armed()` serving both, rather than a second timer for the idle case.
assert.equal(
  (src.match(/const armed = \(/g) ?? []).length,
  1,
  'more than one arm implementation — the two deadlines must share one timer'
);
assert.match(
  src,
  /const armed = \(ms = RECONNECT_SILENCE_MS\)/,
  'armed() no longer takes the deadline as a parameter'
);

// The guard must be armed ONLY by a reconnect: an ordinary long think has no
// deadline at all, which is what the reverted watchdog got wrong.
const step = async ({ arm, partAfterMs, deadlineMs }) => {
  let stalled;
  let timer;
  if (arm) {
    stalled = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('lost connection')),
        deadlineMs
      );
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

// The r5 shape: no reconnect frame, no parts, no close — silence from a
// stream that will never end. Must fail rather than wait forever.
assert.equal(
  await step({ arm: true, partAfterMs: 10_000, deadlineMs: 5 }),
  'failed',
  'a silent stream with no frames at all must be bounded by the idle deadline'
);

console.log(
  'ok — idle deadline from stream start, reconnect guard tightens it'
);
