import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// These guards complement the component tests: none of these states can be
// certified by a timer or by starting a request whose result has not arrived.
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const base = 'frontend/src/components/chat/code-engine/';
const engine = read(`${base}code-engine.tsx`);
assert.doesNotMatch(
  engine,
  /setProgress|estimateTime|project-completed-/,
  'project readiness must not come from elapsed time or a persisted presentation flag'
);
assert.match(
  engine,
  /Preparing your project…/,
  'loading must describe an indeterminate wait'
);
assert.match(
  engine,
  /role="status"/,
  'project preparation needs an accessible status'
);
assert.doesNotMatch(engine, /Initializing project.*%/);
assert.match(
  engine,
  /Your edits are still here/,
  'failed saves must explain that local edits remain'
);

const bar = read(`${base}save-changes-bar.tsx`);
assert.match(bar, />\s*Discard changes\s*</, 'discard must name its effect');
assert.match(bar, />\s*Save file\s*</, 'save must name its target');

const code = read(`${base}tabs/code-tab.tsx`);
assert.doesNotMatch(
  code,
  /the files are unchanged/,
  'a lost restore response cannot prove rollback'
);
assert.match(
  code,
  /couldn.t confirm the restore/i,
  'unknown restore outcomes need an honest warning'
);
assert.match(
  code,
  /versionsError/,
  'history request errors must not look like empty history'
);
assert.match(
  code,
  /onClick=\{\(\) => void loadVersions\(\)\}/,
  'history retry must really reread history'
);

const deploy = read('backend/src/project/deploy.ts');
assert.doesNotMatch(
  deploy,
  /Nothing was deployed/,
  'a timed-out deploy may still have reached Vercel'
);
assert.match(deploy, /Check your Vercel deployments before trying again/);
const dialog = read(`${base}deploy-dialog.tsx`);
assert.match(
  dialog,
  /await navigator\.clipboard\.writeText/,
  'copy success must await the clipboard'
);
assert.match(
  dialog,
  /Select and copy it manually/,
  'clipboard failure needs a recovery instruction'
);
assert.match(
  dialog,
  /aria-label="Deployment URL"[\s\S]{0,120}readOnly/,
  'the full URL must be selectable'
);

const preview = read(`${base}web-view.tsx`);
for (const label of [
  'Go back',
  'Go forward',
  'Refresh preview',
  'Zoom out',
  'Zoom in',
  'Open preview in new tab',
  'Enter full screen',
  'Preview path',
]) {
  assert.ok(
    preview.includes(`aria-label="${label}"`),
    `missing preview accessible name: ${label}`
  );
}
console.log('ok — editor and deployment feedback follows confirmed outcomes');
