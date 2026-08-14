import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * A first turn that ends without a reply must stop the spinner.
 *
 * `needsFirstTurn` is derived from the message list, so it goes true again the
 * instant a first turn finishes without saving an assistant message — and the
 * retry effect cannot re-run, because `firstTurnStartedFor` is latched to the
 * chat id and is only cleared inside `.catch()`. So nothing was coming, and
 * `waitingForFirstTurn` said otherwise forever: bouncing dots, "thinking…",
 * and a Stop button that does nothing (it early-returns on the hook's own
 * `loadingSubmit`, which is already false).
 *
 * The turn that guarantees it is the backend's `t:'error'` frame for a project
 * whose workspace could not be created — it reports the failure and correctly
 * saves no message, so the client resolves with an empty `steps`.
 */
const src = readFileSync('frontend/src/components/chat/index.tsx', 'utf8');

assert.match(
  src,
  /const \[firstTurnEnded, setFirstTurnEnded\] = useState\(false\)/,
  'the first-turn settled flag is gone — a turn that ends with no reply ' +
    'leaves the page spinning forever with a dead Stop button'
);

// It has to be set on the resolve path. The reject path is the retry's, and
// that one already re-arms itself.
assert.match(
  src,
  /startTurn\([\s\S]*?\)\s*\.then\(\(\) => setFirstTurnEnded\(true\)\)/,
  'startTurn no longer records that the first turn finished'
);

// And it has to actually gate the indicator.
const waiting = src.match(/const waitingForFirstTurn =[\s\S]*?;/)?.[0] ?? '';
assert.ok(waiting, 'waitingForFirstTurn is gone');
assert.match(
  waiting,
  /!firstTurnEnded/,
  'waitingForFirstTurn ignores whether the turn already ended, so the ' +
    'spinner never stops'
);

// Reset per chat, or opening a second chat inherits the first one's verdict.
assert.match(
  src,
  /useEffect\(\(\) => setFirstTurnEnded\(false\), \[chatId\]\)/,
  'the settled flag is not reset when the chat changes'
);

console.log('ok — a first turn that answers nothing still stops the spinner');
