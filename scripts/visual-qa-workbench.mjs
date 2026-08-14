#!/usr/bin/env node
/**
 * Visual QA walk — workbench (toolbar Notes, Changes panel) and the admin
 * console, at desktop 1440 and compact 430. Companion to visual-qa.mjs;
 * same stack, same qa/ output, also not part of `pnpm check`.
 *
 * Needs a chat id to open, and an account holding the Admin role for the
 * console half (otherwise that section screenshots the role-gated refusal,
 * which is itself worth seeing).
 *
 *   node scripts/visual-qa-workbench.mjs --chat <chatId>
 *
 * Its first run found html projects asking the backend to boot a dev server
 * on every poll — a 500 each time, for the product's default project kind.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { assertAlive } from './visual-qa-alive.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'qa');
mkdirSync(root, { recursive: true });

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? d : process.argv[i + 1];
};
const BASE = arg('url', 'http://localhost:3001');
const API = arg('api', 'http://localhost:8081');
const CHAT = arg('chat', '');
const EMAIL = arg('email', 'qa@codefox.test');
const PASSWORD = arg('password', 'QaPassw0rd!23');

const DESKTOP = { width: 1440, height: 900 };
const COMPACT = { width: 430, height: 860 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const notes = [];
const say = (m) => {
  notes.push(m);
  console.log(m);
};
const shot = async (page, name) => {
  await page.screenshot({ path: join(root, `${name}.png`) });
  console.log(`  shot ${name}.png`);
};
function watch(page, label) {
  page.on('pageerror', (e) => say(`!! [${label}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error')
      say(`!! [${label}] console: ${m.text().slice(0, 160)}`);
  });
}

const gql = async (query, token) => {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query }),
  });
  return res.json();
};

const { data: auth } = await gql(
  `mutation{login(input:{email:"${EMAIL}",password:"${PASSWORD}"}){accessToken refreshToken}}`
);
if (!auth?.login) throw new Error('login failed');

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox'],
  executablePath:
    process.env.CHROME_PATH ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

const openPage = async (vp) => {
  const page = await browser.newPage();
  await page.setViewport(vp);
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
  }, auth.login);
  return page;
};

// ── Workbench: toolbar Notes + Changes panel ──────────────────────
for (const [vp, tag] of [[DESKTOP, 'desktop'], [COMPACT, 'compact']]) {
  const page = await openPage(vp);
  watch(page, `workbench-${tag}`);
  await page.goto(`${BASE}/chat?id=${CHAT}`, { waitUntil: 'networkidle2' });
  await sleep(6000);
  await assertAlive(page, `workbench-${tag}`);
  await shot(page, `10-workbench-${tag}`);

  // On compact the toolbar collapses into a "More actions" menu.
  if (tag === 'compact') {
    await page.evaluate(() => {
      document.querySelector('[aria-label="More actions"]')?.click();
    });
    await sleep(700);
    await shot(page, `11-overflow-menu-${tag}`);
  }

  const notesFound = await page.evaluate(() => {
    const all = [...document.querySelectorAll('button, [role=menuitem]')];
    const b = all.find((el) => /^notes$/i.test((el.textContent ?? '').trim()));
    if (b) b.click();
    return Boolean(b);
  });
  say(
    notesFound
      ? `ok  [workbench-${tag}] Notes control reachable`
      : `!! [workbench-${tag}] Notes control NOT reachable`
  );
  if (notesFound) {
    await sleep(1500);
    await shot(page, `12-notes-dialog-${tag}`);
    const body = await page.evaluate(() => document.body.innerText);
    // A brand-new project has no NOTES.md: the 404 must read as an empty
    // contract (the "# Notes" starter), not an error.
    say(
      /# Notes/.test(body)
        ? `ok  [workbench-${tag}] empty contract shows the starter template`
        : `!! [workbench-${tag}] notes dialog did not show the starter`
    );
    say(
      /Could not read/i.test(body)
        ? `!! [workbench-${tag}] notes dialog shows a read error`
        : `ok  [workbench-${tag}] no read error`
    );
    // Escape out.
    await page.keyboard.press('Escape');
    await sleep(500);
  }

  // Changes panel — Code tab.
  await page.evaluate(() => {
    const all = [...document.querySelectorAll('button, [role=menuitem]')];
    all.find((el) => /^code$/i.test((el.textContent ?? '').trim()))?.click();
  });
  await sleep(2500);
  await shot(page, `13-changes-panel-${tag}`);
  await page.close();
}

// ── Admin console ─────────────────────────────────────────────────
// Needs the Admin role; grant it directly so the page is reachable.
for (const [vp, tag] of [[DESKTOP, 'desktop'], [COMPACT, 'compact']]) {
  const page = await openPage(vp);
  watch(page, `admin-${tag}`);
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await sleep(4000);
  await shot(page, `14-admin-${tag}`);
  const body = await page.evaluate(() => document.body.innerText);
  say(`--  [admin-${tag}] first 120 chars: ${body.slice(0, 120).replace(/\n/g, ' | ')}`);
  await page.close();
}

writeFileSync(join(root, 'notes2.txt'), notes.join('\n') + '\n');
await browser.close();
console.log('\n--- findings ---');
console.log(notes.join('\n'));
