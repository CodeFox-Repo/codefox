import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');
const shared = read('frontend/src/components/design-systems.tsx');
const hook = read('frontend/src/hooks/useChatStream.ts');

// A restyle rewrites the page, so the lint findings on screen describe a page
// the user is no longer looking at. Both callers live in different subtrees
// from the lint state, so they announce and the hook listens.
assert.match(
  shared,
  /export const announceRestyled = \(\) =>\s*\n?\s*window\.dispatchEvent\(new Event\(PROJECT_RESTYLED\)\)/,
  'the shared announce helper is gone'
);
assert.ok(
  /addEventListener\(PROJECT_RESTYLED, clear\)/.test(hook) &&
    /removeEventListener\(PROJECT_RESTYLED, clear\)/.test(hook),
  'useChatStream no longer clears lint on restyle (or leaks the listener)'
);

// BOTH restyle paths must announce — the palette card and the toolbar picker.
for (const [path, what] of [
  ['frontend/src/components/chat/question-card.tsx', 'palette card'],
  [
    'frontend/src/components/chat/code-engine/responsive-toolbar.tsx',
    'toolbar picker',
  ],
]) {
  const src = read(path);
  assert.ok(
    /announceRestyled\(\)/.test(src),
    `the ${what} restyle no longer announces — its findings go stale`
  );
  // Only on success: a refused restyle left the page alone, so the findings
  // still describe what is on screen.
  assert.match(
    src,
    /result\?\.ok\)\s*\{?\s*\n?\s*announceRestyled\(\)/,
    `the ${what} announces even when the restyle was refused`
  );
}

console.log('ok — both restyle paths clear stale lint findings');
