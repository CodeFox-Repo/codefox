import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * An `await` that lands after the user moved on must not write state.
 *
 * Three places had the same shape — start a fetch for one id, `await`, then
 * `setState` with no check that the id is still current — and each one had a
 * durable consequence rather than a flicker:
 *
 *   code-engine getCode  A slow read for a big file landed after a fast read
 *                        for a small one, so the editor showed file A's body
 *                        while `filePath`, the tree and the tab all said B.
 *                        One keystroke plus Save wrote A over B ON DISK, and
 *                        preCode was poisoned too, so Reset restored A as
 *                        well. Nothing refetched to reveal it.
 *   web-view initWebUrl  The backend's waitForPort runs up to 90s. A switch
 *                        in that window left the old call alive: on success
 *                        it pointed the iframe at the PREVIOUS project's dev
 *                        server; its catch nulled the CURRENT project's
 *                        guard, spent the shared attempt budget, and
 *                        rescheduled itself. Neither self-heals.
 *   HtmlPreview load     Called from a 5s poll AND the Refresh button, so the
 *                        guard is keyed on what was fetched, not on an effect
 *                        flag. Clicking through to about.html mid-poll
 *                        rendered index.html under an ABOUT.HTML header and
 *                        shot a cover of the wrong page.
 *
 * Asserted as "the guard is present and sits between the await and the
 * setState", which is the property that actually matters.
 */
const read = (p) => readFileSync(p, 'utf8');

const engine = read('frontend/src/components/chat/code-engine/code-engine.tsx');
const view = read('frontend/src/components/chat/code-engine/web-view.tsx');

/** The body of a named function, up to its closing brace at that indent. */
const slice = (src, from, to) => {
  const start = src.indexOf(from);
  assert.ok(start !== -1, `cannot find ${from}`);
  const end = src.indexOf(to, start);
  assert.ok(end !== -1, `cannot find the end of ${from}`);
  return src.slice(start, end);
};

// --- code-engine getCode: the one that corrupted a file on disk ---
const getCode = slice(engine, 'async function getCode()', 'getCode();');
assert.match(
  getCode,
  /if \(superseded\) return;/,
  'code-engine getCode lost its stale-response guard — a slow file read can ' +
    'again put one file’s contents in the editor under another file’s name, ' +
    'and saving then overwrites the named file with them'
);
assert.ok(
  getCode.indexOf('await authenticatedFetch') <
    getCode.indexOf('if (superseded) return;'),
  'the getCode guard moved above the await, where it cannot catch anything'
);
assert.ok(
  getCode.indexOf('if (superseded) return;') < getCode.indexOf('setCode('),
  'the getCode guard no longer runs before setCode'
);
assert.match(
  engine,
  /let superseded = false;[\s\S]*?return \(\) => \{\s*superseded = true;/,
  'the getCode effect no longer flips `superseded` in its cleanup, so the ' +
    'guard is never armed'
);

// --- web-view initWebUrl: success AND catch both write shared refs ---
const init = slice(view, 'const initWebUrl = async ()', 'initWebUrl();');
assert.ok(
  init.indexOf('await getWebUrl(projectPath)') <
    init.indexOf('if (superseded) return;\n        containerRef.current'),
  'initWebUrl no longer bails after the await — a stale call can point the ' +
    'iframe at the previous project’s dev server'
);
// The catch is the subtler half: it must bail BEFORE touching shared refs.
const catchAt = init.indexOf('} catch (error) {');
const guardInCatch = init.indexOf('if (superseded) return;', catchAt);
assert.ok(guardInCatch !== -1, 'initWebUrl’s catch lost its guard');
for (const shared of [
  'lastProjectPathRef.current = null',
  '++attemptsRef.current',
  'retryTimerRef.current = setTimeout',
]) {
  const at = init.indexOf(shared, catchAt);
  assert.ok(at !== -1, `initWebUrl’s catch no longer touches ${shared}`);
  assert.ok(
    guardInCatch < at,
    `a superseded initWebUrl still reaches \`${shared}\` — a dead epoch ` +
      'clears the live project’s guard, spends its retry budget, or ' +
      'reschedules itself'
  );
}
assert.match(
  view,
  /return \(\) => \{\s*superseded = true;/,
  'the initWebUrl effect cleanup no longer marks the epoch dead'
);

// --- HtmlPreview load: keyed on what was fetched, not on an effect flag ---
const load = slice(
  view,
  'const load = async ()',
  '  useEffect(() => {\n    load();'
);
assert.match(
  load,
  /const wanted = `\$\{project\.projectPath\}\/\$\{page\}`/,
  'HtmlPreview load no longer records which page it asked for'
);
assert.ok(
  load.indexOf('await res.json()') < load.indexOf('wanted !== showing.current'),
  'the HtmlPreview guard runs before the await, where it catches nothing'
);
assert.ok(
  load.indexOf('wanted !== showing.current') < load.indexOf('setHtml('),
  'HtmlPreview can again render one page under another page’s header'
);

console.log(
  'ok — a response that arrives late cannot write state it no longer owns'
);
