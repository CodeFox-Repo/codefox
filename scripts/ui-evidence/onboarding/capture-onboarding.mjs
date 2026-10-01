import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const before = resolve(process.env.ONBOARDING_COPY_BEFORE_DIR || '../codefox-copy-baseline');
const after = resolve(process.env.ONBOARDING_COPY_AFTER_DIR || '../codefox-copy-audit');
const output = resolve(process.env.ONBOARDING_COPY_OUTPUT_DIR || './artifacts');
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
  for (const [label, directory, port, nextPort] of [['before', before, 3201, 3208], ['after', after, 3101, 3108]]) {
    logs[label] = '';
    const server = http.createServer(async (req, res) => {
      res.setHeader('Content-Security-Policy', csp);
      res.setHeader('X-Codefox-Review', 'synthetic-onboarding-copy-fixture');
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
  for (const port of [3201, 3101]) {
    const until = Date.now() + 180000;
    while (true) {
      try { const result = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(15000) }); if (result.ok) break; } catch {}
      assert.ok(Date.now() < until, `Next fixture ${port} did not become ready`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  browser = await chromium.launch({ headless: true });
  for (const [label, port] of [['before', 3201], ['after', 3101]]) {
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
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.evaluate(({label, commit}) => {
      const badge = document.createElement('div');
      badge.textContent = `UI TEST · synthetic read-only API fixture · ${label} ${commit.slice(0, 8)}`;
      badge.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:8px;background:#172033;color:#fff;font:12px monospace;z-index:2147483647;text-align:center';
      document.body.appendChild(badge);
    }, {label, commit: sha(label === 'before' ? before : after)});
    const input = label === 'after' ? page.getByRole('textbox', { name: 'Describe your project', exact: true }) : page.locator('textarea').first();
    if (label === 'after') {
      assert.match(await page.getByRole('heading', {level:1}).innerText(), /Describe a page/);
      assert.equal(await page.getByText('Claude Code inside', {exact:true}).count(), 0);
      assert.equal(await page.getByText('no cloud API key', {exact:false}).count(), 0);
    }
    await page.screenshot({ path: join(output, `onboarding-hero-${label}.png`) });
    await page.getByRole('button', { name: label === 'after' ? 'Create project' : 'Create', exact: true }).click();
    if (label === 'after') {
      await page.getByRole('alert').filter({hasText:'Describe your project first.'}).waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0);
    } else await page.getByRole('dialog').waitFor();
    await page.screenshot({ path: join(output, `onboarding-empty-${label}.png`) });
    if (label === 'before') await page.getByRole('button', {name:'Close',exact:true}).click();
    await input.fill('A portfolio for an architect');
    await page.getByRole('button', { name: label === 'after' ? 'Create project' : 'Create', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    if (label === 'after') await page.getByText('Sign in or create an account to continue', {exact:true}).waitFor();
    await page.screenshot({ path: join(output, `onboarding-auth-${label}.png`) });
    await page.getByRole('button', {name:'Close',exact:true}).click();
    assert.equal(await input.inputValue(), 'A portfolio for an architect');
    assert.equal(page.url(), `${origin}/`);
    await page.setViewportSize({width:390,height:844});
    await input.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth), true, 'Composer must fit compact viewport');
    await page.screenshot({ path: join(output, `onboarding-compact-${label}.png`) });
    await context.close();
  }
  assert.equal(mutations, 0, 'Screenshot capture must not submit accounts, generation, or paid model requests');
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
