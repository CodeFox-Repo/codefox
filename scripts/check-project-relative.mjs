import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('frontend/src/components/chat/chat-list.tsx', 'utf8');
assert.ok(
  src.includes('{projectRelative(content)}'),
  'message bodies no longer strip the sandbox path'
);

// The regex, verbatim from chat-list.tsx.
const projectRelative = (text) =>
  text.replace(/(?:\/[\w.-]+)*\/projects\/[\w.-]+\//g, '');

assert.equal(
  projectRelative('I updated /tmp/x/data/projects/codex-a1b2/index.html'),
  'I updated index.html'
);
assert.equal(
  projectRelative('edited /projects/p1/src/app/page.tsx'),
  'edited src/app/page.tsx'
);
assert.equal(
  projectRelative('see index.html and styles.css'),
  'see index.html and styles.css',
  'text with no sandbox path must be untouched'
);
assert.equal(
  projectRelative('the /projects/ page of the site'),
  'the /projects/ page of the site',
  'prose that merely says projects must not be eaten'
);

console.log('ok — sandbox paths stripped, ordinary prose left alone');
