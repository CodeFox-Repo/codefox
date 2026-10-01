#!/usr/bin/env node
/** CI-only orchestration. Browser controls stay in the isolated capture jobs. */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const here = dirname(fileURLToPath(import.meta.url));
const scenario = process.env.EVIDENCE_SCENARIO;
const before = resolve(process.env.BEFORE_DIR);
const after = resolve(process.env.AFTER_DIR);
const output = resolve(process.env.EVIDENCE_OUTPUT);
const expectedBase = 'dd33611e3debb0170b801f42370cda55d6c5caa7';
const expectedAfter = process.env.AFTER_SHA;
const sha = (cwd) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
assert.ok(['auth', 'project-feedback', 'editor', 'onboarding'].includes(scenario));
assert.match(expectedAfter ?? '', /^[a-f0-9]{40}$/);
assert.equal(sha(before), expectedBase, 'wrong baseline checkout');
assert.equal(sha(after), expectedAfter, 'wrong feature checkout');
await mkdir(output, { recursive: true });
const metadata = {
  scenario, baseline: sha(before), feature: sha(after), harness: sha(here),
  syntheticFixtures: true,
  fixtureOverrides: scenario === 'editor' ? ['temporary offline layout', 'temporary fixture route importing real components'] : [],
  limitations: 'Actual application components with deterministic local API/context responses. No production account, email, generation, deployment or real clipboard-permission validation.',
  startedAt: new Date().toISOString(), status: 'running',
};
const saveMetadata = () => writeFile(join(output, 'run.json'), JSON.stringify(metadata, null, 2));
await saveMetadata();

const children = new Set();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const start = (script, args, name, { cwd = here, env = {} } = {}) => {
  const log = createWriteStream(join(output, `${name}.log`));
  const child = spawn(process.execPath, [script, ...args], {
    cwd, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', ...env },
    detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.on('error', (error) => log.write(String(error)));
  child.once('close', () => { log.end(); children.delete(child); });
  children.add(child);
  return child;
};
const stop = async (child) => {
  if (child.exitCode === null && child.signalCode === null) {
    process.kill(-child.pid, 'SIGTERM');
    await Promise.race([once(child, 'close'), delay(10000)]);
    if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid, 'SIGKILL');
  }
};
const run = async (script, args, name, options) => {
  const child = start(script, args, name, options);
  const [code, signal] = await once(child, 'close');
  assert.equal(code, 0, `${name} failed (${signal || code}); see ${name}.log`);
};
const ready = async (url, child) => {
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, `Next exited before ${url} became ready`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (response.ok) return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${url}; inspect the Next log`);
};

try {
  if (scenario === 'auth') {
    await run(join(here, 'auth/capture.mjs'), [], 'auth-capture', { env: {
      AUTH_COPY_BEFORE_DIR: before, AUTH_COPY_AFTER_DIR: after, AUTH_COPY_OUTPUT_DIR: output,
    } });
  } else if (scenario === 'project-feedback') {
    const state = join(output, 'fixture-state.json');
    await writeFile(state, JSON.stringify({ scenario: 'normal', isPublic: false }));
    start(join(here, 'project-feedback/fixture-server.mjs'), [], 'fixture-server', {
      env: { CODEFOX_FIXTURE_DIR: output, CODEFOX_FIXTURE_PORT: '3116' },
    });
    for (const [mode, directory, port] of [['before', before, 3202], ['after', after, 3102]]) {
      const next = start(join(directory, 'frontend/node_modules/next/dist/bin/next'), ['dev', '--hostname', '127.0.0.1', '--port', String(port)], `${mode}-next`, {
        cwd: join(directory, 'frontend'), env: {
          NEXT_PUBLIC_GRAPHQL_URL: 'http://localhost:3116/graphql',
          NEXT_PUBLIC_GRAPHQL_WS_URL: 'ws://localhost:3116/graphql',
          NEXT_PUBLIC_BACKEND_URL: 'http://localhost:3116',
          NEXT_PUBLIC_DEV_EMAIL: 'fixture@example.test', NEXT_PUBLIC_DEV_PASSWORD: 'fixture-only',
        },
      });
      try {
        await ready(`http://127.0.0.1:${port}/`, next);
        await run(join(here, 'project-feedback/capture-project-feedback.mjs'), ['--repo', directory, '--url', `http://localhost:${port}`, '--mode', mode, '--state', state, '--out', join(output, mode)], `${mode}-capture`);
      } finally { await stop(next); }
    }
  } else if (scenario === 'editor') {
    for (const [mode, directory, port] of [['before', before, 3203], ['after', after, 3103]]) {
      await run(join(here, 'editor/setup-fixture.mjs'), [directory], `${mode}-setup`);
      const next = start(join(directory, 'frontend/node_modules/next/dist/bin/next'), ['dev', '--hostname', '127.0.0.1', '--port', String(port)], `${mode}-next`, { cwd: join(directory, 'frontend') });
      try {
        await ready(`http://127.0.0.1:${port}/editor-feedback-fixture?case=save`, next);
        await run(join(here, 'editor/capture.mjs'), [`http://127.0.0.1:${port}`, mode, join(output, mode)], `${mode}-capture`, { env: { EVIDENCE_CURRENT_SHA: sha(directory) } });
      } finally { await stop(next); }
    }
  } else {
    await run(join(here, 'onboarding/capture-onboarding.mjs'), [], 'onboarding-capture', { env: {
      ONBOARDING_COPY_BEFORE_DIR: before, ONBOARDING_COPY_AFTER_DIR: after, ONBOARDING_COPY_OUTPUT_DIR: output,
    } });
  }
  metadata.status = 'passed';
} catch (error) {
  metadata.status = 'failed';
  metadata.error = String(error.stack || error);
  throw error;
} finally {
  for (const child of [...children]) await stop(child);
  metadata.finishedAt = new Date().toISOString();
  await saveMetadata();
}
