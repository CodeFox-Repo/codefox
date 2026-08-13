#!/usr/bin/env node
/**
 * The rescue save is the only thing standing between "the user walked away"
 * and "the turn's answer is gone forever". It hinges entirely on WHERE
 * `finished = true` sits: the close handler reads that flag to tell a
 * finished turn from an abandoned one.
 *
 * Set it before the finally block's awaits (session stop, snapshot, lint —
 * seconds of them) and a client that hangs up in that window is treated as
 * finished, so the reply it never received is never saved. Set it after
 * `res.end()` and every normal turn double-saves.
 *
 * There is exactly one correct position: after the awaits, immediately
 * before `res.end()`. This asserts that, because the bug is invisible in
 * every test that does not hang up mid-await.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(
  new URL('../backend/src/chat/chat.controller.ts', import.meta.url),
  'utf8',
);

// The finally block of runTurn — from the last `} finally {` to `res.end()`.
const finallyStart = src.indexOf('} finally {', src.indexOf('private async runTurn'));
assert.ok(finallyStart > 0, 'runTurn no longer has a finally block');
const end = src.indexOf('res.end();', finallyStart);
assert.ok(end > 0, 'the finally block no longer ends the response');
const block = src.slice(finallyStart, end);

const at = (needle) => {
  const i = block.indexOf(needle);
  assert.ok(i > 0, `finally block no longer contains ${needle}`);
  return i;
};

const finished = at('finished = true');
// Every await that can take real time must happen while the turn still
// counts as unfinished, so a hang-up during any of them still rescues.
assert.ok(
  at("endSession('stop'") < finished,
  'finished is set before the session stops — a hang-up there loses the reply',
);
assert.ok(
  at('this.snapshotTurn(') < finished,
  'finished is set before the snapshot — a hang-up there loses the reply',
);
assert.ok(
  at('this.lintPage(') < finished,
  'finished is set before the lint — a hang-up there loses the reply',
);
// …but before res.end(), whose own close event must see a finished turn or
// every reply is stored twice.
assert.ok(
  finished < block.length,
  'finished is set after res.end() — every normal turn now double-saves',
);

// The rescue itself must still be conditional on both halves: an unfinished
// turn AND something worth saving.
assert.ok(
  /if \(!finished && reply\.trim\(\)\)/.test(src),
  'the rescue save no longer checks both `!finished` and a non-empty reply',
);

console.log('ok — rescue save survives every await in the finally block');
