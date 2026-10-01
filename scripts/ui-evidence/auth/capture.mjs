import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const before = resolve(process.env.AUTH_COPY_BEFORE_DIR || '../codefox-auth-before');
const after = resolve(process.env.AUTH_COPY_AFTER_DIR || '../codefox-fix-auth');
const output = resolve(process.env.AUTH_COPY_OUTPUT_DIR || './artifacts');
const expectedBase = 'dd33611e3debb0170b801f42370cda55d6c5caa7';
const sha = (cwd) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
assert.equal(sha(before), expectedBase, 'Before checkout must use the audited base commit');
await mkdir(output, { recursive: true });
const data = {
  registrationOpen: true, emailVerificationRequired: false,
  googleAuthAvailable: false, passwordResetEmailAvailable: false,
  fetchPublicProjects: [], getAvailableModelTags: [], scenarios: [],
  designSystems: [], getUserChats: [], getUserProjects: [], me: null, myRoles: [],
};
const processes = [], servers = [], logs = {};
let mutations = 0;
let browser;
let lastPage;
let lastLabel;
const csp = "connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:;";
try {
  for (const [label, directory, port, nextPort] of [['before', before, 3204, 3206], ['after', after, 3104, 3106]]) {
    logs[label] = '';
    const server = http.createServer(async (req, res) => {
      res.setHeader('Content-Security-Policy', csp);
      res.setHeader('X-Codefox-Review', 'synthetic-auth-copy-fixture');
      if (req.url === '/graphql') {
        let body = ''; for await (const chunk of req) body += chunk;
        const request = JSON.parse(body || '{}');
        res.setHeader('Content-Type', 'application/json');
        if (/\bmutation\b/.test(request.query || '')) {
          mutations++;
          res.end(JSON.stringify({ errors: [{ message: 'Review fixture: submissions disabled.' }] }));
        } else res.end(JSON.stringify({ data }));
        return;
      }
      if (req.url?.startsWith('/api/')) {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Review fixture: API actions disabled.' }));
        return;
      }
      const proxy = http.request({ host: '127.0.0.1', port: nextPort, path: req.url, method: req.method, headers: { ...req.headers, host: `localhost:${nextPort}` } }, response => {
        res.writeHead(response.statusCode, { ...response.headers, 'Content-Security-Policy': csp });
        response.pipe(res);
      });
      proxy.on('error', () => { res.writeHead(503); res.end('Waiting for local Next server'); });
      req.pipe(proxy);
    });
    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    servers.push(server);
    const child = spawn(process.execPath, [join(directory, 'frontend/node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(nextPort)], {
      cwd: join(directory, 'frontend'),
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_GRAPHQL_URL: `http://localhost:${port}/graphql`, NEXT_PUBLIC_GRAPHQL_WS_URL: `ws://localhost:${port}/graphql`, NEXT_PUBLIC_BACKEND_URL: `http://localhost:${port}` },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { logs[label] += chunk; });
    processes.push(child);
  }
  for (const port of [3204, 3104]) {
    const until = Date.now() + 180000;
    while (true) {
      try { const result = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(15000) }); if (result.ok) break; } catch {}
      assert.ok(Date.now() < until, `Next fixture ${port} did not become ready`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  browser = await chromium.launch({ headless: true });
  for (const [label, port] of [['before', 3204], ['after', 3104]]) {
    const origin = `http://localhost:${port}`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === origin ? route.continue() : route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    lastPage = page;
    lastLabel = label;
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ label, commit }) => {
      const badge = document.createElement('div');
      badge.textContent = `UI TEST · synthetic read-only auth fixture · ${label} ${commit.slice(0, 8)}`;
      badge.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:8px;background:#172033;color:#fff;font:12px monospace;z-index:2147483647;text-align:center';
      document.body.appendChild(badge);
    }, { label, commit: sha(label === 'before' ? before : after) });
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.getByLabel('Password', { exact: true }).fill('abcde1');
    if (label === 'after') {
      await page.getByText('Use at least 6 characters and at least two of these:', { exact: false }).waitFor();
      await page.getByLabel('Display name', { exact: true }).waitFor();
    } else await page.getByText('Include at least one uppercase letter', { exact: true }).waitFor();
    await page.screenshot({ path: join(output, `auth-signup-${label}.png`) });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.getByRole('button', { name: 'Forgot your password?', exact: true }).click();
    await page.getByLabel('Email', { exact: true }).fill('review@example.test');
    const send = page.getByRole('button', { name: 'Send reset link', exact: true });
    if (label === 'after') {
      await page.getByText('Password reset email isn’t available on this site right now.', { exact: true }).waitFor();
      assert.equal(await send.isDisabled(), true);
      await page.getByRole('dialog', { name: 'Reset your password', exact: true }).waitFor();
    } else assert.equal(await send.isEnabled(), true);
    await page.screenshot({ path: join(output, `auth-reset-unavailable-${label}.png`) });
    await context.close();
  }
  assert.equal(mutations, 0, 'Screenshot capture must not submit account or email mutations');
  await writeFile(join(output, 'metadata.json'), JSON.stringify({ before: sha(before), after: sha(after), syntheticFixture: true, mailEnabled: false, viewport: { width: 1440, height: 1000 }, mutationsSubmitted: mutations }, null, 2));
} catch (error) {
  if (lastPage && !lastPage.isClosed()) {
    await lastPage.screenshot({ path: join(output, `failure-${lastLabel}.png`), timeout: 10000 }).catch(() => {});
  }
  await writeFile(join(output, 'failure.json'), JSON.stringify({ label: lastLabel, error: String(error.stack || error), mutationsSubmitted: mutations }, null, 2));
  throw error;
} finally {
  await browser?.close();
  for (const child of processes) child.kill('SIGTERM');
  for (const server of servers) server.closeAllConnections?.();
  for (const server of servers) server.close();
  for (const [label, log] of Object.entries(logs)) await writeFile(join(output, `next-${label}.log`), log);
}
