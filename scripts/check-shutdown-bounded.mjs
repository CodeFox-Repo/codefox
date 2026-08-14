import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Shutdown must be bounded, because `app.close()` is not.
 *
 * Nest's close waits for every in-flight request to finish, and an agent turn
 * holds its ndjson response open for 9-10 minutes. `NestFactory.create` is
 * called without `forceCloseConnections`, so nothing severs those sockets —
 * the close simply blocks. The platform's grace period is far shorter, so an
 * unbounded close does not buy a clean exit: it guarantees the SIGKILL lands
 * mid-write at a moment we did not choose. A deadline costs the turn (whose
 * partial reply the backend already rescue-saves) and keeps the exit ours.
 */
const src = readFileSync('backend/src/main.ts', 'utf8');

assert.match(
  src,
  /const SHUTDOWN_MS = [\d_]+;/,
  'the shutdown deadline is gone — a single in-flight agent turn blocks exit ' +
    'for minutes, until the platform SIGKILLs the process mid-write'
);

const handler = src.slice(src.indexOf('process.on(signal'));
assert.ok(handler, 'the signal handler is gone');

// The timer has to be armed BEFORE the await it is meant to bound.
assert.ok(
  handler.indexOf('setTimeout(') < handler.indexOf('await app.close()'),
  'the deadline is armed after app.close() is awaited, so it can never fire'
);
assert.match(
  handler,
  /setTimeout\([\s\S]*?process\.exit\(0\)[\s\S]*?SHUTDOWN_MS\)/,
  'the deadline no longer exits the process when it fires'
);

// Unref'd, or the timer itself is the thing keeping the process alive.
assert.match(
  handler,
  /deadline\.unref\?\.\(\)/,
  'the shutdown timer is not unref’d, so it holds the event loop open for ' +
    'its full duration even when the close finished immediately'
);

// A second SIGTERM must not start a second teardown over the first.
assert.match(
  handler,
  /if \(closing\) return;/,
  'a repeated signal starts a second concurrent shutdown'
);

// The old `await server.close()` was a no-op (http.Server.close returns the
// server, not a promise) and Nest's close already shuts the server down.
// Checked against the handler body, not the whole file — the comment above
// that line names the dead call, and matching prose is how a check lies.
assert.ok(
  !/await server\.close\(\)/.test(handler),
  'the dead `await server.close()` is back'
);

console.log('ok — shutdown exits on our terms rather than waiting for SIGKILL');
