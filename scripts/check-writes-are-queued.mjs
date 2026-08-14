import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every writer of a project's files takes the same queue.
 *
 * `project-queue.ts` says so in its own docstring — "anything that writes a
 * project's files can join the same line" — but two callers never did:
 *
 *   POST /api/file      the editor's Save. It could land between an agent
 *                       turn reading a file and writing it back, so the
 *                       user's edit vanished into the agent's commit with no
 *                       error anywhere. Exactly the race the queue exists for.
 *   POST /api/project/restore   worse: it replaces the WHOLE working tree, so
 *                       a concurrent turn wrote into a tree being rewritten
 *                       underneath it.
 *
 * A grep-based check because the property is "no caller is missing", and the
 * way that breaks is someone adding a fifth writer, not someone editing these.
 */
const writers = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith('.ts') && !full.includes('__tests__')) {
      const text = readFileSync(full, 'utf8');
      // The workspace abstraction is the one way to write project files;
      // its own two implementations are what it is implemented in terms of.
      if (/host-workspace|vercel-workspace|workspace\.ts$/.test(full)) continue;
      for (const m of text.matchAll(
        /^.*\b(?:workspace|source)\.(?:writeFile|restore)\(.*$/gm,
      )) {
        writers.push({ file: full, line: m[0].trim(), text });
      }
    }
  }
};
walk('backend/src');

assert.ok(
  writers.length >= 3,
  `found only ${writers.length} project-file writers — the pattern this ` +
    'check greps for has changed, so it is no longer checking anything'
);

for (const { file, line, text } of writers) {
  // The write has to sit inside a queueForProject callback. Checking the
  // file imports it is the cheap proxy; the enclosing-call check below is
  // what makes it real.
  assert.ok(
    /queueForProject/.test(text),
    `${file} writes project files but never joins the write queue:\n    ${line}\n` +
      '  A concurrent agent turn can overwrite it, or have its own writes ' +
      'clobbered, with no error on either side.'
  );
}

// The two that were actually missing, named so a revert is unambiguous.
const files = readFileSync('backend/src/project/files.controller.ts', 'utf8');
for (const [route, marker] of [
  ['POST /api/file', 'writeFile'],
  ['POST /api/project/restore', 'restore(versionId)'],
]) {
  const at = files.indexOf(marker);
  assert.ok(at !== -1, `${route}: cannot find its write (${marker})`);
  const before = files.slice(Math.max(0, at - 700), at);
  assert.ok(
    /queueForProject\(/.test(before),
    `${route} writes outside the project queue again — it can interleave ` +
      'with a running agent turn'
  );
}

console.log('ok — every writer of a project’s files takes the same queue');
