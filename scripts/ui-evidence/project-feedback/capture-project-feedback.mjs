#!/usr/bin/env node
/**
 * CI-only browser regression evidence against the actual CodeFox Next app.
 * Usage: node capture-project-feedback.mjs --repo /checkout --url http://localhost:3102 --mode after --out ./after
 * Requires the fixture server and Next dev configured as documented in README.md.
 * No production endpoints, real accounts, model generation, or publication.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const here = dirname(fileURLToPath(import.meta.url));
const option = (key, fallback) => { const index = process.argv.indexOf(`--${key}`); return index < 0 ? fallback : process.argv[index + 1]; };
const repo = resolve(option('repo', '.'));
const url = option('url', 'http://localhost:3102');
const mode = option('mode', 'after');
assert(['before', 'after'].includes(mode));
const output = resolve(option('out', join(here, mode)));
mkdirSync(output, { recursive: true });
const require = createRequire(join(repo, 'backend/package.json'));
const puppeteer = require('puppeteer');
const statePath = option('state', join(here, 'fixture-state.json'));
const requestPath = join(dirname(statePath), 'fixture-requests.jsonl');
const scenario = (name, extras = {}) => writeFileSync(statePath, JSON.stringify({ scenario: name, isPublic: false, ...extras }));
const requestCount = (operation) => {
  try { return readFileSync(requestPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((request) => request.op === operation).length; }
  catch { return 0; }
};
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
page.setDefaultTimeout(45000);
page.setDefaultNavigationTimeout(180000);
const errors = [];
const consoleMessages = [];
const failedRequests = [];
page.on('console', (message) => { if (message.type() === 'error') consoleMessages.push(message.text()); });
page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
// Seed only a synthetic local fixture session before the app hydrates. This
// avoids racing the development login button and never signs into an account.
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('accessToken', 'local-fixture-only-not-a-credential');
  localStorage.setItem('refreshToken', 'local-fixture-only-not-a-credential');
});
page.on('pageerror', (error) => errors.push(error.message));
// CI isolation: the fixture endpoints are the only browser network destinations.
await page.setRequestInterception(true);
page.on('request', (request) => {
  const address = request.url();
  if (/^(data:|blob:|about:)/.test(address) || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(address)) request.continue();
  else if (address === 'https://api.github.com/repos/Sma1lboy/codefox') request.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: '{"stargazers_count":0}' });
  else request.abort();
});
const bodyText = () => page.evaluate(() => document.body.innerText);
const waitText = (text) => page.waitForFunction((value) => document.body.innerText.includes(value), {}, text);
const clickText = async (selector, text) => {
  const handle = await page.waitForFunction((selector, text) => [...document.querySelectorAll(selector)].find((node) => node.textContent.trim() === text && node.getBoundingClientRect().width > 0), {}, selector, text);
  const element = handle.asElement();
  assert(element, `Missing ${selector} with text ${text}`);
  await element.click();
};
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const capture = async (name) => {
  await page.evaluate((label) => {
    document.querySelector('[data-qa-evidence]')?.remove();
    const caption = document.createElement('div');
    caption.dataset.qaEvidence = 'true';
    caption.textContent = label;
    caption.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:99999;padding:6px 10px;background:#111;color:#eee;border:1px solid #777;font:11px monospace;pointer-events:none';
    document.body.appendChild(caption);
  }, `LOCAL FIXTURE · actual CodeFox UI · ${mode.toUpperCase()} ${sourceCommit.slice(0, 8)} · ${name}`);
  await page.screenshot({ path: join(output, `${name}.png`), fullPage: false });
  writeFileSync(join(output, `${name}.txt`), await bodyText());
};
const home = async () => {
  await page.goto(url, { waitUntil: 'networkidle2' });
  await waitText('What are we building?');
};
const openProjectMenu = async () => {
  // Radix restores pointer events/focus after the closing dialog unmounts.
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]') && getComputedStyle(document.body).pointerEvents !== 'none');
  await page.click('[aria-label="Project options"]');
  await page.waitForSelector('[role="menu"]');
};
const chat = async () => {
  await page.goto(`${url}/chat?id=fixture-chat`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[aria-label="Chat options"]');
  await waitText('Show the project-action feedback fixture.');
};
const clearMenu = async () => {
  await page.click('[aria-label="Chat options"]');
  await clickText('[role="menuitem"]', 'Clear history');
};
try {
  scenario('normal');
  await home();
  // Warm the real chat route before capturing its short-lived duplicate toasts.
  await chat();
  await home();
  await openProjectMenu();
  await clickText('[role="menuitem"]', mode === 'after' ? 'Rename chat' : 'Rename');
  await page.waitForSelector('[role="dialog"]');
  await waitText(mode === 'after' ? 'Rename chat' : 'Rename project');
  await capture('01-rename-scope');
  await clickText('button', 'Cancel');

  scenario('duplicate-error');
  // The duplicate case starts from its own page load; rename/dialog timing
  // is not a prerequisite for observing the independent duplicate outcome.
  await home();
  await openProjectMenu();
  await clickText('[role="menuitem"]', 'Duplicate');
  await waitText(mode === 'after' ? 'Could not duplicate this project. Try again.' : 'Could not delete the project');
  if (mode === 'after') assert(!(await bodyText()).includes('Could not delete the project'));
  await capture('02-duplicate-failure');

  scenario('normal');
  await home();
  await openProjectMenu();
  await clickText('[role="menuitem"]', 'Duplicate');
  await waitText(mode === 'after' ? 'Project duplicated' : 'Project deleted');
  if (mode === 'after') assert(!(await bodyText()).includes('Project deleted'));
  await capture('03-duplicate-success');

  scenario('list-error');
  await home();
  await waitText(mode === 'after' ? 'Could not load your projects' : 'Nothing yet.');
  await waitText(mode === 'after' ? 'Could not load public projects' : 'Nothing published yet');
  await capture('04-query-failure');
  if (mode === 'after') {
    assert(!(await bodyText()).includes('Nothing published yet'));
    scenario('normal');
    await clickText('button', 'Try again');
    await page.waitForSelector('[aria-label="Project options"]');
    await clickText('button', 'Try again');
    await waitText('Yours');
    assert(!(await bodyText()).includes('Could not load'));
  }

  scenario('normal');
  await chat();
  const countBefore = requestCount('ClearChatHistory');
  await clearMenu();
  if (mode === 'after') {
    await waitText('Clear chat history?');
    assert.equal(requestCount('ClearChatHistory'), countBefore, 'Opening confirmation sent a clear mutation');
    await capture('05-clear-confirmation');
    await clickText('button', 'Cancel');
    assert.equal(requestCount('ClearChatHistory'), countBefore, 'Cancel sent a clear mutation');
    assert((await bodyText()).includes('Show the project-action feedback fixture.'));
    await clearMenu();
    await page.keyboard.press('Escape');
    assert.equal(requestCount('ClearChatHistory'), countBefore, 'Escape sent a clear mutation');
  } else {
    await waitText('History cleared');
    assert.equal(requestCount('ClearChatHistory'), countBefore + 1);
    await capture('05-clear-immediate');
  }

  scenario('clear-error');
  await chat();
  await clearMenu();
  if (mode === 'after') await clickText('button', 'Clear history');
  await waitText(mode === 'after' ? 'Could not clear chat history. Try again.' : 'Could not clear the history');
  if (mode === 'after') assert(await page.$('[role="dialog"]'), 'Failed confirmation closed');
  await capture('06-clear-failure');
  if (mode === 'after') await clickText('button', 'Cancel');

  scenario('normal');
  await chat();
  await waitText(mode === 'after' ? 'Make public' : 'Private');
  await capture('07-visibility-desktop');
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
  await clickText('button', 'Preview');
  await page.click('[aria-label="More actions"]');
  await waitText(mode === 'after' ? 'Currently private.' : 'Private');
  await capture('08-visibility-compact');
  assert.equal(errors.length, 0, `Uncaught browser errors: ${errors.join('; ')}`);
  writeFileSync(join(output, 'capture.json'), JSON.stringify({
    mode, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    url, fixtureBackend: 'local deterministic server', screenshots: 8,
    verified: ['rename scope', 'duplicate success and failure', 'query failures and retry', 'clear confirmation, Cancel, Escape, and failed clear', 'desktop and compact visibility labels'],
    limitations: 'Actual Next/React/Radix UI with fake GraphQL/file data and a non-credential fixture token. No live backend/account, model generation, real clipboard denial, publishing, or deployment.',
    pageErrors: errors, consoleErrors: consoleMessages, failedRequests,
  }, null, 2));
  console.log(`${mode}: verified eight genuine component screenshots in ${output}`);
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png'), timeout: 10000 }).catch(() => {});
  writeFileSync(join(output, 'failure.json'), JSON.stringify({ mode, commit: sourceCommit, error: String(error.stack || error), pageErrors: errors, consoleErrors: consoleMessages, failedRequests }, null, 2));
  throw error;
} finally { await browser.close(); }
