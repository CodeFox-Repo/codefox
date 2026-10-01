import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const [base, tag, output] = process.argv.slice(2);
assert.ok(base && ['before', 'after'].includes(tag) && output, 'usage: node capture.mjs URL before|after OUTPUT');
const dir = resolve(output);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const blocked = [];
const results = [];
let lastPage;
let lastScenario;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    blocked.push(url.origin + url.pathname);
    return route.abort();
  });
  for (const scenario of ['preparing', 'history', 'save', 'deploy', 'preview']) {
    const page = await context.newPage();
    lastPage = page;
    lastScenario = scenario;
    if (scenario === 'save') await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`${base}/editor-feedback-fixture?case=${scenario}`, { waitUntil: 'networkidle' });
    await page.getByText(/LOCAL CODEFOX FIXTURE/).waitFor();
    if (scenario === 'preparing') {
      await page.getByText(tag === 'before' ? /Initializing project \(/ : 'Preparing your project…', { exact: tag === 'after' }).waitFor();
      results.push({ scenario, waitingText: await page.locator('body').innerText() });
    }
    if (scenario === 'history') {
      await page.getByRole('button', { name: 'History', exact: true }).click();
      await page.getByText(tag === 'before' ? /No history yet/ : "Couldn't load version history. Try again.").waitFor();
      if (tag === 'after') {
        await page.getByRole('button', { name: 'Try again', exact: true }).click();
        await page.getByText("Couldn't load version history. Try again.").waitFor();
      }
      results.push({ scenario, visibleText: await page.locator('body').innerText() });
    }
    if (scenario === 'save') {
      const discard = page.getByRole('button', { name: tag === 'before' ? 'Reset' : 'Discard changes', exact: true });
      const save = page.getByRole('button', { name: tag === 'before' ? 'Save' : 'Save file', exact: true });
      const boxes = [await discard.boundingBox(), await save.boundingBox()];
      if (tag === 'after') for (const box of boxes) assert.ok(box && box.x >= 0 && box.x + box.width <= 320, 'save action overflows the 320px viewport');
      results.push({ scenario, viewport: 320, actionBoxes: boxes });
    }
    if (scenario === 'deploy') {
      await page.getByLabel('Vercel token').fill('fixture-token-not-a-credential');
      await page.getByRole('button', { name: 'Deploy', exact: true }).click();
      await page.getByRole('link', { name: 'https://fixture.example.test/codefox-deployment' }).waitFor();
      await page.getByRole('button', { name: 'Copy deployment URL', exact: true }).click();
      if (tag === 'before') {
        await page.locator('.lucide-check').waitFor();
        results.push({ scenario, falselyShowsCopiedCheckAfterRejection: true });
      } else {
        const fallback = page.getByRole('textbox', { name: 'Deployment URL', exact: true });
        await fallback.waitFor();
        assert.equal(await fallback.inputValue(), 'https://fixture.example.test/codefox-deployment');
        assert.equal(await fallback.getAttribute('readonly'), '');
        results.push({ scenario, selectableFallback: true, copyStatus: await page.getByRole('status').allTextContents() });
      }
    }
    if (scenario === 'preview') {
      const controls = await page.locator('button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.getAttribute('aria-label'), text: button.textContent })));
      if (tag === 'after') for (const label of ['Go back', 'Go forward', 'Refresh preview', 'Zoom out', 'Zoom in', 'Open preview in new tab', 'Enter full screen']) assert.ok(controls.some((control) => control.label === label), `missing ${label}`);
      results.push({ scenario, controls });
    }
    await page.evaluate(({ tag, commit }) => {
      const badge = document.createElement('div');
      badge.textContent = `UI TEST · mocked editor context/API · ${tag} ${commit.slice(0, 8)}`;
      badge.style.cssText = 'position:fixed;top:0;right:0;max-width:100%;padding:3px 6px;background:#172033;color:#fff;font:10px monospace;z-index:2147483647;text-align:center;pointer-events:none';
      document.body.appendChild(badge);
    }, { tag, commit: process.env.EVIDENCE_CURRENT_SHA || 'unknown' });
    await page.screenshot({ path: join(dir, `${tag}-${scenario}.png`) });
    await page.close();
  }
  assert.deepEqual(blocked, [], 'fixture attempted an external request');
  await writeFile(join(dir, `${tag}-observations.json`), JSON.stringify({ tag, base, commit: process.env.EVIDENCE_CURRENT_SHA, fixtures: 'real components; mocked context, HTTP/Apollo, clipboard; 320px actual viewport for save bar', blockedExternalRequests: blocked, results }, null, 2));
} catch (error) {
  if (lastPage && !lastPage.isClosed()) {
    await lastPage.screenshot({ path: join(dir, `${tag}-failure-${lastScenario}.png`), timeout: 10000 }).catch(() => {});
  }
  await writeFile(join(dir, `${tag}-failure.json`), JSON.stringify({ tag, scenario: lastScenario, commit: process.env.EVIDENCE_CURRENT_SHA, error: String(error.stack || error), blockedExternalRequests: blocked, results }, null, 2));
  throw error;
} finally {
  await browser.close();
}
