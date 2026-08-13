import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('frontend/src/components/chat/code-engine/tabs/code-tab.tsx', 'utf8');
assert.ok(src.includes('{changesLoading && !changes ? ('), 'spinner no longer gated on !changes — a refetch blanks the list');
assert.ok(src.includes('{!changesLoading && lint && lint.length > 0 && ('), 'findings no longer gated on changesLoading — they tear from the file list');
assert.ok(src.includes('}, [projectPath, turnsDone]);'), 'changes effect no longer refetches on turn end');
assert.ok(src.includes('}, [view, projectPath, turnsDone]);'), 'history effect no longer refetches on turn end');
assert.ok(src.includes('{versionsLoading && !versions ? ('), 'history spinner no longer gated on !versions');
// The tab click must not also load: two owners double-fetch on first open.
assert.ok(src.includes('onClick={() => setView(v)}'), 'the tab click loads versions again — it can double-fire with the effect');

// The two gates, as the JSX evaluates them.
const spinner = (loading, changes) => loading && !changes;
const findings = (loading, lint) => !loading && lint.length > 0;
const F = [{ id: 'x' }];

assert.equal(spinner(true, null), true, 'first load must show the spinner');
assert.equal(spinner(true, [{}]), false, 'a refetch must not blank a populated list');
assert.equal(spinner(false, [{}]), false);
assert.equal(findings(true, F), false, 'findings must hide while the list refetches');
assert.equal(findings(false, F), true, 'findings must show once the list has landed');
assert.equal(findings(false, []), false, 'no findings, no panel');
console.log('ok — refresh gates hold across 6 states, both panels wired');
