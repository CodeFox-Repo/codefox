#!/usr/bin/env node
/**
 * A restyle is the one design decision that never runs an agent turn — it is
 * a GraphQL mutation that swaps the token block and returns. So nothing told
 * the agent the look had changed, and the next turn built against the old one.
 *
 * Guards the wiring `style-note.spec.ts` cannot see: that the note is written
 * where every turn reads it, inside the same queued block as the page write,
 * and that its failure cannot fail a restyle that already succeeded.
 *
 * Deliberately NOT guarding the planner path: the question card answers
 * through a real turn, and the agent's own instructions already tell it to
 * record decisions. Writing those from the backend too is the double-write
 * that produces duplicate lines.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const service = read('backend/src/project/project.service.ts');

// The same file the prompt reads. A note written to anything else is invisible.
assert.match(
  service,
  /writeFile\('NOTES\.md', noteStyle\(notes, system\.name\)\)/,
  'restyle no longer records the design system in NOTES.md'
);
assert.match(
  read('backend/src/chat/chat.controller.ts'),
  /readFile\('NOTES\.md'\)/,
  'turns no longer read NOTES.md — the note would go nowhere'
);

// Inside the queued read-modify-write, not after it: the page write and its
// note are one decision, and a concurrent turn must not land between them.
const queued = service.slice(
  service.indexOf('return queueForProject(project.projectPath'),
  service.indexOf('async deployProject')
);
assert.ok(
  queued.includes("writeFile('index.html', restyled)") &&
    queued.includes("writeFile('NOTES.md'"),
  'the note escaped the project queue — a turn can now interleave with it'
);

// Best-effort: the page is already restyled by this point, so a failed
// footnote must not report "could not restyle".
assert.match(
  queued,
  /try \{[\s\S]*?readFile\('NOTES\.md'\)[\s\S]*?\} catch/,
  'a failed note now fails the whole restyle, which already succeeded'
);

// Replaces rather than appends. NOTES.md is clipped into every prompt, so an
// append-only log of every style tried would crowd out real decisions.
const note = read('backend/src/project/style-note.ts');
assert.match(
  note,
  /const STYLE_LINE = \/\^-\\s\*design system:.*\/im/,
  'the style line is no longer matched case-insensitively / multiline'
);
assert.match(note, /\.replace\(STYLE_LINE, next\)/, 'the note appends instead of replacing');

// Behaviour, not just source: five restyles leave one line.
const STYLE_LINE = /^-\s*design system:.*$/im;
const noteStyle = (notes, name) => {
  const next = `- Design system: ${name}`;
  const existing = notes?.trim();
  if (!existing) return `# Notes\n${next}\n`;
  if (STYLE_LINE.test(existing)) return `${existing.replace(STYLE_LINE, next)}\n`;
  return `${existing}\n${next}\n`;
};
let n = null;
for (const s of ['Editorial', 'Neon', 'Glass', 'Luxury', 'Minimal']) n = noteStyle(n, s);
assert.equal(
  n.match(/Design system:/g).length,
  1,
  'trying five styles leaves five lines — NOTES.md grows without bound'
);

console.log('ok — a restyle is recorded once, where every turn reads it');
