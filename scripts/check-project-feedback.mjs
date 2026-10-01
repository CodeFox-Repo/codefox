#!/usr/bin/env node
/** Source contracts for audited project-action feedback. Run with pnpm check. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) =>
  readFileSync(new URL(`../frontend/src/${path}`, import.meta.url), 'utf8');
const workbench = read('components/root/workbench.tsx');
const publicProjects = read('components/root/public-projects.tsx');
const toolbar = read('components/chat/code-engine/responsive-toolbar.tsx');
const context = read('components/chat/code-engine/project-context.tsx');

assert.doesNotMatch(
  workbench,
  /useMutation\(DUPLICATE_PROJECT,\s*deleted\)/,
  'Duplicate must never reuse deletion feedback'
);
assert.match(
  workbench,
  /if \(!id\)\s*throw new Error/,
  'Duplicate must not report success without the new chat id'
);
assert.match(workbench, /Project duplicated/);
assert.match(workbench, /<DialogTitle>Rename chat<\/DialogTitle>/);
assert.match(workbench, /aria-label="Chat title"/);
assert.match(workbench, /Could not load your projects/);
assert.match(publicProjects, /Could not load public projects/);
for (const source of [workbench, publicProjects]) {
  assert.match(
    source,
    /error[\s\S]*role="alert"/,
    'Failed project queries must have a visible error, not an empty state'
  );
  assert.match(source, /Try again/);
}
assert.match(toolbar, /Make private/);
assert.match(toolbar, /Make public/);
assert.match(toolbar, /Currently public/);
assert.match(toolbar, /Currently private/);
assert.doesNotMatch(
  toolbar,
  /navigator\.clipboard\.writeText/,
  'Toolbar copies must use awaited clipboard feedback'
);
for (const path of [
  'components/chat/chat-topbar.tsx',
  'components/sidebar-item.tsx',
]) {
  const source = read(path);
  assert.match(source, /<ClearHistoryDialog/);
  assert.doesNotMatch(
    source,
    /onSelect=\{\(\) => clearHistory/,
    'Clear history must ask before removing messages'
  );
}
const confirmation = read('components/chat/clear-history-dialog.tsx');
assert.match(confirmation, /project files stay/);
assert.match(confirmation, /Cancel/);
assert.match(
  confirmation,
  /pending\.current/,
  'Clear history must prevent same-tick repeated submissions'
);
assert.match(confirmation, /clearChatHistory/);
assert.match(
  read('lib/copy-text.ts'),
  /await navigator\.clipboard\.writeText\(text\);\s*toast\.success/
);
assert.match(context, /Could not remix this project/);
assert.match(context, /message\.includes\('which is the limit of'\)/);
assert.match(context, /message\.includes\('your own'\)/);
console.log(
  'ok — project feedback matches actions, query errors, and confirmed history clearing'
);
