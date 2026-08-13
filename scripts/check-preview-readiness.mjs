#!/usr/bin/env node
/**
 * The preview's readiness rule, which is easy to regress back into the stub
 * it replaced: readiness IS the /api/preview response. The backend awaits its
 * own waitForPort and throws when the dev server exits or times out, so a
 * returned url already means the port answers — and the browser cannot
 * re-check it anyway (cross-origin; the preflight is refused).
 *
 * A script rather than a test suite, matching the other check-*.mjs here:
 * the frontend has no test runner.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const view = read('../frontend/src/components/chat/code-engine/web-view.tsx');
const ctx = read('../frontend/src/components/chat/code-engine/project-context.tsx');

// The dead machinery must stay dead.
for (const ghost of [
  'checkServiceReady',
  'startServiceReadyCheck',
  'isServiceReady',
  'serviceCheckAttempts',
  'MAX_CHECK_ATTEMPTS',
  'serviceCheckTimerRef',
]) {
  assert.ok(!view.includes(ghost), `${ghost} is back — the stub machinery returned`);
}

// The retry has to be reachable. It was gated on a counter nothing incremented.
assert.ok(view.includes('onClick={retryPreview}'), 'the Retry button lost its handler');
assert.ok(view.includes('{failure && ('), 'failure state no longer renders');
assert.ok(!view.includes('Retry Check'), 'the old unreachable button is back');

// Giving up is the point: retrying forever is what hid a dev server that was
// never coming up.
assert.ok(/MAX_ATTEMPTS\s*=\s*\d+/.test(view), 'no attempt cap — the preview spins forever again');
assert.ok(view.includes('attemptsRef.current >= MAX_ATTEMPTS'), 'the cap is never checked');

// HANDOFF's "500 after ~2min" stayed undiagnosed because the body was dropped.
assert.ok(ctx.includes('await response.text()'), 'the error body is discarded again — the 500 is undiagnosable');
assert.ok(ctx.includes('Preview failed ('), 'the status code no longer reaches the message');

/** Mirrors the diagnostic extraction in getWebUrl. */
const detailOf = (body, statusText) => {
  const parsed = (() => {
    try {
      return JSON.parse(body)?.message;
    } catch {
      return body.slice(0, 300);
    }
  })();
  return parsed || statusText;
};

assert.equal(
  detailOf('{"message":"Preview for abc exited during startup"}', 'Internal Server Error'),
  'Preview for abc exited during startup',
  "Nest's message must survive — it names which dev server died",
);
assert.equal(detailOf('plain text boom', 'Bad Gateway'), 'plain text boom', 'a non-JSON body must still show');
assert.equal(detailOf('', 'Internal Server Error'), 'Internal Server Error', 'an empty body falls back to the status text');
assert.equal(detailOf('{}', 'Bad Gateway'), 'Bad Gateway', 'JSON with no message falls back too');
assert.equal(detailOf('x'.repeat(500), 'Bad Gateway').length, 300, 'a huge body must be clipped');

console.log('ok — readiness is the response, retry reachable, diagnostics survive');
