#!/usr/bin/env node
/**
 * Run every check, then report. The old one-liner was
 * `for f in ...; do node "$f" || exit 1; done` — it stopped at the FIRST
 * failure, so one stale assertion hid the state of every check behind it.
 * Tonight that happened for real: a guard was intact, its check's regex had
 * gone stale after a reformat, and the other 33 checks reported nothing at
 * all.
 *
 * Still exits non-zero if anything failed, so CI is unchanged.
 *
 * ponytail: sequential, no concurrency. The whole suite is ~13s; a worker
 * pool would save seconds and cost a scheduler.
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const checks = readdirSync(here)
  .filter((f) => f.startsWith('check-') && f.endsWith('.mjs'))
  .sort();

const failed = [];
for (const file of checks) {
  const run = spawnSync(process.execPath, [join(here, file)], {
    encoding: 'utf8',
  });
  if (run.status === 0) {
    process.stdout.write(run.stdout);
  } else {
    failed.push(file);
    // The assertion message is the whole point of a failure; keep it, but
    // one line so 34 checks still fit on a screen.
    const why =
      (run.stderr || run.stdout)
        .split('\n')
        .find((l) => /AssertionError|Error:/.test(l))
        ?.trim() ?? 'failed with no message';
    console.log(`FAIL ${file}\n     ${why.slice(0, 160)}`);
  }
}

console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed`,
);
if (failed.length) {
  console.log(`failing: ${failed.join(', ')}`);
  process.exit(1);
}
