import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * A turn writes nothing while the agent thinks, and thinking for half a minute
 * before the next tool call is ordinary. Next's dev proxy — the path `pnpm dev`
 * puts every local user on — hangs up on a response idle that long, and the
 * hang-up reaches the backend as `close`, which it reads as the user leaving:
 * `clientGone`, session destroyed, build abandoned about forty seconds in.
 *
 * Measured before the fix: three builds in a row died at 0:40, 0:40 and 1:09,
 * each after ~30s with no part to forward, each leaving
 * "[Request interrupted by user]" in the agent transcript and the scaffold on
 * screen. The same turn driven straight at :8080 ran past 80s of silence.
 */
const controller = readFileSync('backend/src/chat/chat.controller.ts', 'utf8');

assert.ok(
  /setInterval\(\s*\(\) => \{[^}]*send\(\{ t: 'ping' \}\)/.test(controller),
  'the agent stream no longer sends a keepalive — a silent think reads as a hang-up again'
);
assert.ok(
  /clearInterval\(keepalive\)/.test(controller),
  'the keepalive interval is never cleared — a finished turn keeps writing'
);
// Inside the finally, not the try: a turn that threw must stop pinging too.
const finallyBlock = controller.slice(controller.indexOf('} finally {'));
assert.ok(
  finallyBlock.indexOf('clearInterval(keepalive)') !== -1,
  'clearInterval sits outside the finally — an errored turn leaks the interval'
);

// The interval must be shorter than the ~30s the proxy tolerates, with room
// for a write that lands late.
const every = Number(controller.match(/send\(\{ t: 'ping' \}\)[\s\S]{0,80}?\}, ([\d_]+)\)/)?.[1]?.replace(/_/g, ''));
assert.ok(
  every > 0 && every <= 15_000,
  `keepalive every ${every}ms is too slow for a proxy that hangs up at ~30s`
);

/**
 * The other half of the contract: the browser must ignore an event type it
 * does not know. A `default:` that throws or surfaces an error would turn the
 * keepalive itself into the failure.
 */
const client = readFileSync('frontend/src/api/ChatStreamAPI.ts', 'utf8');
const handler = client.slice(client.indexOf('switch (event.t)'));
assert.ok(
  !/^\s*default:/m.test(handler.slice(0, handler.indexOf('\n  };'))),
  'the ndjson parser grew a default branch — an unknown event is no longer ignored'
);

// And the parser, verbatim in shape: an unknown `t` reaches no callback.
const seen = [];
const handle = (event) => {
  switch (event.t) {
    case 'text':
      seen.push('text');
      break;
    case 'tool':
      seen.push('tool');
      break;
    case 'error':
      seen.push('error');
      break;
    case 'lint':
      seen.push('lint');
      break;
  }
};
handle({ t: 'ping' });
assert.deepEqual(seen, [], 'a ping must be inert on the client');

console.log('ok — the agent stream pings through a silent think, the client ignores it');
