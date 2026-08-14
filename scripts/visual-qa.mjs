#!/usr/bin/env node
/**
 * Visual QA walk — auth surfaces (sign-in modal, forgot password,
 * /reset-password, settings password row) at desktop 1440 and compact 430.
 * Screenshots land in qa/ (gitignored).
 *
 * NOT part of `pnpm check`: it needs a running stack, which the check
 * scripts deliberately do not. It exists because a night of UI shipped with
 * zero browser verification, and its first run found a reset link that read
 * `undefined/reset-password?token=...` — a dead link on any deploy missing
 * FRONTEND_URL, whose only symptom is a user who cannot get back in.
 *
 * Stack it expects: backend on 8081, frontend production build on 3001.
 *   node scripts/visual-qa.mjs [--token <reset-token>] [--url http://localhost:3001]
 *
 * A reset token comes from calling requestPasswordReset with
 * MAIL_ENABLED=false and reading the link out of the backend log.
 * The QA account (qa@codefox.test) is created by hand; see HANDOFF.
 *
 * ponytail: system Chrome via executablePath, not a downloaded one —
 * `~/.cache/puppeteer` is empty here and a screenshot is not worth a 170MB
 * download. Override with CHROME_PATH.
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
const URL_BASE = arg('url', 'http://localhost:3001');
const TOKEN = arg('token', '');
const EMAIL = 'qa@codefox.test';
const PASSWORD = 'QaPassw0rd!23';

const DESKTOP = { width: 1440, height: 900 };
const COMPACT = { width: 430, height: 860 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const notes = [];
const say = (m) => {
  notes.push(m);
  console.log(m);
};

const shot = async (page, name) => {
  const path = join(root, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  shot ${name}.png`);
};

/** Fail loudly rather than screenshot an empty page. */
function watch(page, label) {
  page.on('pageerror', (e) => say(`!! [${label}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') say(`!! [${label}] console: ${m.text().slice(0, 200)}`);
  });
}

/** Put the tokens where AuthProvider reads them, so we start signed in. */
async function signIn(page) {
  const res = await fetch(`${URL_BASE.replace('3001', '8081')}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation{login(input:{email:"${EMAIL}",password:"${PASSWORD}"}){accessToken refreshToken}}`,
    }),
  });
  const { data } = await res.json();
  if (!data?.login) throw new Error('QA login failed');
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
  }, data.login);
  return data.login;
}

// ponytail: the system Chrome, not a downloaded one — puppeteer's cache is
// empty here and a 170MB download is not a prerequisite for a screenshot.
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox'],
  executablePath:
    process.env.CHROME_PATH ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

// ── 1. Sign-in modal + forgot password ────────────────────────────
for (const [vp, tag] of [[DESKTOP, 'desktop'], [COMPACT, 'compact']]) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  watch(page, `signin-${tag}`);
  await page.goto(URL_BASE, { waitUntil: 'networkidle2' });
  await sleep(1200);
  await assertAlive(page, `landing-${tag}`);
  await shot(page, `01-landing-${tag}`);

  // Open the sign-in modal from the nav.
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, a')].find((el) =>
      /sign in/i.test(el.textContent ?? '')
    );
    if (b) b.click();
    return Boolean(b);
  });
  if (!opened) {
    say(`!! [signin-${tag}] no "Sign in" control found on the landing page`);
  } else {
    await sleep(900);
    await shot(page, `02-signin-modal-${tag}`);

    const hasForgot = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((b) =>
        /forgot your password/i.test(b.textContent ?? '')
      )
    );
    say(
      hasForgot
        ? `ok  [signin-${tag}] "Forgot your password?" present`
        : `!! [signin-${tag}] forgot-password entry MISSING`
    );

    if (hasForgot) {
      await page.evaluate(() =>
        [...document.querySelectorAll('button')]
          .find((b) => /forgot your password/i.test(b.textContent ?? ''))
          .click()
      );
      await sleep(700);
      await shot(page, `03-forgot-form-${tag}`);

      // "Or continue with" must be hidden here.
      const dividerVisible = await page.evaluate(() => {
        const el = [...document.querySelectorAll('span')].find((s) =>
          /or continue with/i.test(s.textContent ?? '')
        );
        if (!el) return false;
        return el.getBoundingClientRect().height > 0;
      });
      say(
        dividerVisible
          ? `!! [signin-${tag}] "Or continue with" still visible on the reset form`
          : `ok  [signin-${tag}] google divider hidden on reset form`
      );
    }
  }
  await page.close();
}

// ── 2. Reset password page ────────────────────────────────────────
for (const [vp, tag] of [[DESKTOP, 'desktop'], [COMPACT, 'compact']]) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  watch(page, `reset-${tag}`);

  await page.goto(`${URL_BASE}/reset-password`, { waitUntil: 'networkidle2' });
  await sleep(900);
  await shot(page, `04-reset-no-token-${tag}`);

  if (TOKEN) {
    await page.goto(`${URL_BASE}/reset-password?token=${encodeURIComponent(TOKEN)}`, {
      waitUntil: 'networkidle2',
    });
    await sleep(900);
    await shot(page, `05-reset-form-${tag}`);

    // Mismatch is the one rule the server cannot enforce.
    await page.evaluate(() => {
      const set = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const inputs = [...document.querySelectorAll('input[type=password]')];
      set(inputs[0], 'brandnewpassword1');
      set(inputs[1], 'doesnotmatch1');
    });
    await sleep(300);
    await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .find((b) => /update password/i.test(b.textContent ?? ''))
        ?.click()
    );
    await sleep(700);
    await shot(page, `06-reset-mismatch-${tag}`);
    const shown = await page.evaluate(() =>
      /do not match/i.test(document.body.innerText)
    );
    say(
      shown
        ? `ok  [reset-${tag}] mismatch is caught client-side`
        : `!! [reset-${tag}] mismatch produced no message`
    );
  }
  await page.close();
}

// ── 3. Settings: password row ─────────────────────────────────────
for (const [vp, tag] of [[DESKTOP, 'desktop'], [COMPACT, 'compact']]) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  watch(page, `settings-${tag}`);
  await signIn(page);
  await page.goto(`${URL_BASE}/settings`, { waitUntil: 'networkidle2' });
  await sleep(1800);
  await shot(page, `07-settings-${tag}`);

  const hasRow = await page.evaluate(() => /password/i.test(document.body.innerText));
  say(
    hasRow
      ? `ok  [settings-${tag}] password row rendered`
      : `!! [settings-${tag}] no password row (hasPassword never answered?)`
  );

  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((el) =>
      /change password/i.test(el.textContent ?? '')
    );
    if (b) b.click();
    return Boolean(b);
  });
  if (opened) {
    await sleep(600);
    await shot(page, `08-settings-password-form-${tag}`);
  } else {
    say(`!! [settings-${tag}] "Change password" button not found`);
  }
  await page.close();
}

writeFileSync(join(root, 'notes.txt'), notes.join('\n') + '\n');
await browser.close();
console.log('\n--- findings ---');
console.log(notes.length ? notes.join('\n') : 'none');
