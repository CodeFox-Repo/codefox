#!/usr/bin/env node
/**
 * Compile the backend without depending on `nest` being on PATH.
 *
 * `pnpm --filter codefox-backend build` runs `nest build`, which needs the
 * CLI's bin link. On this deploy that link has gone missing repeatedly —
 * `sh: 1: nest: not found` — and prefixing PATH with the workspace bin did not
 * settle it, so the cause is the link itself rather than where PATH points.
 *
 * Node's resolver does not care about bin links: it walks up from the backend
 * package through every node_modules above it, which finds the CLI whether the
 * installer hoisted it or kept it local. If even that fails, the message says
 * what was searched instead of a bare "not found".
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = join(dirname(fileURLToPath(import.meta.url)), '..', 'backend');
const require = createRequire(join(backend, 'package.json'));

let cli;
try {
  cli = require.resolve('@nestjs/cli/bin/nest.js');
} catch (error) {
  console.error(
    `Could not find @nestjs/cli from ${backend}. ` +
      `Is it installed? (${error.code})`,
  );
  process.exit(1);
}

console.log(`nest cli: ${cli}`);
execFileSync(process.execPath, [cli, 'build'], {
  cwd: backend,
  stdio: 'inherit',
});
