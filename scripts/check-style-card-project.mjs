#!/usr/bin/env node
/**
 * The style card must restyle THIS chat's project.
 *
 * It read `curProject` from ProjectContext, which tracks the URL's `id` —
 * but that id is a CHAT id and the context matches it against PROJECT ids,
 * so it never matched and the context kept whatever `lastProjectId`
 * localStorage held. Picking a palette then rewrote a different project's
 * index.html, silently. web-view.tsx documents the same trap; CodeEngine
 * fixed it by preferring its own resolved project.
 *
 * Structural, because reproducing it needs two projects, a stale
 * localStorage and a live agent turn.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const card = read('../frontend/src/components/chat/question-card.tsx');

assert.ok(
  !/curProject/.test(card),
  'question-card reads curProject again — it restyles whatever project localStorage last held',
);
assert.ok(
  !/ProjectContext/.test(card),
  'question-card imports ProjectContext again — the global project is not this chat\'s project',
);
assert.ok(
  /projectId\?: string;/.test(card),
  'question-card no longer takes the project as a prop',
);
assert.ok(
  /variables: \{ projectId, styleId \}/.test(card),
  'the restyle mutation no longer uses the passed-in projectId',
);
assert.ok(
  /if \(!projectId\) return;/.test(card),
  'applyStyle no longer refuses to fire without a project — it would restyle undefined',
);

// The prop has to actually arrive: index -> chat-panel -> chat-list -> card.
for (const [file, needle] of [
  ['../frontend/src/components/chat/index.tsx', 'projectId={projectId}'],
  ['../frontend/src/components/chat/chat-panel.tsx', 'projectId={projectId}'],
  ['../frontend/src/components/chat/chat-list.tsx', 'projectId={projectId}'],
]) {
  assert.ok(read(file).includes(needle), `${file} no longer passes projectId down`);
}

// Both call sites — the mobile branch renders its own ChatContent.
const index = read('../frontend/src/components/chat/index.tsx');
assert.equal(
  (index.match(/projectId=\{projectId\}/g) ?? []).length >= 4,
  true,
  'a ChatContent or CodeEngine call site lost projectId (mobile branch renders its own)',
);

// Cards sized for the chat panel, not the viewport: `sm:grid-cols-3` keyed
// off window width, so a wide screen put 3 cards in an ~18% panel at 56px
// each and every label truncated.
assert.ok(
  !/sm:grid-cols-3/.test(card),
  'the style grid keys off the viewport again — cards go 56px wide in the chat panel',
);

// A token the user did not ask to remember must not survive a cancel.
const deploy = read('../frontend/src/components/chat/code-engine/deploy-dialog.tsx');
assert.ok(
  /if \(!next && !remember\) setToken\(''\);/.test(deploy),
  'the deploy dialog keeps a typed token after cancel — it reopens pre-filled as if saved',
);

console.log('ok — style card hits this chat\'s project, cards fit the panel, token clears on cancel');
