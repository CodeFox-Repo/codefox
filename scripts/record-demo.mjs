#!/usr/bin/env node
/*
 * Records the landing-page demo by driving the real running app, the same way
 * kobe records its quicklook: a scripted, re-runnable capture of the actual
 * product rather than a hand-made screen recording. Re-run it after a UI
 * change and the demo is current again.
 *
 * Usage:  pnpm demo:record            (app must already be up: pnpm dev)
 *         pnpm demo:record -- --url http://localhost:3000 --keep-webm
 *
 * ponytail: puppeteer's own screencast + ffmpeg. No Remotion, no frame
 * pipeline — the web app is already a renderer, unlike kobe's PTY.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'frontend/public/demo');
const webm = join(outDir, 'quicklook.webm');
const mp4 = join(outDir, 'quicklook.mp4');
const poster = join(outDir, 'quicklook-poster.jpg');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const url = arg('url', 'http://localhost:3000');
const keepWebm = process.argv.includes('--keep-webm');

const PROMPT = 'a habit tracker with streaks and a weekly summary';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Scroll smoothly in the page rather than jumping, so the capture reads as a
// human scrolling instead of a cut.
const glide = async (page, to, ms) => {
  await page.evaluate(
    (top, duration) =>
      new Promise((done) => {
        const from = window.scrollY;
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          window.scrollTo(0, from + (top - from) * eased);
          t < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      }),
    to,
    ms
  );
};

const run = async () => {
  mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true, // new headless — the old shell can't screencast
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
    args: ['--force-color-profile=srgb', '--hide-scrollbars'],
  });

  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle2' });
    if (!response?.ok()) {
      throw new Error(
        `${url} responded ${response?.status()}. Start the app first: pnpm dev`
      );
    }
    await page.evaluate(() => {
      // The demo <video> is the thing we are recording — don't film the hole.
      document.querySelector('video')?.closest('section')?.remove();
      // A fresh local database makes "Featured Projects" render its empty
      // state. That is a dev-environment artifact, not the product, and it
      // drags into the last frame on a page this length.
      const projects = document.querySelector('section:last-of-type');
      if (projects?.textContent?.includes('Featured Projects')) {
        projects.remove();
      }
    });
    await page.waitForSelector('textarea');
    await sleep(600);

    // Stage headings, resolved from the DOM so the beats survive copy edits
    // and stay off the empty "Featured Projects" tail.
    const stageTops = await page.evaluate(() =>
      [...document.querySelectorAll('h2')]
        .slice(0, 3)
        .map((h) => h.getBoundingClientRect().top + window.scrollY - 120)
    );

    const recorder = await page.screencast({ path: webm });

    await sleep(1600);
    await page.click('textarea');
    await page.type('textarea', PROMPT, { delay: 45 });
    await sleep(2000);

    await glide(page, stageTops[0], 1600);
    await sleep(1800);
    await glide(page, stageTops[2], 1600);
    await sleep(2200);

    await recorder.stop();
    await page.close();
  } finally {
    await browser.close();
  }

  if (statSync(webm).size < 10_000) {
    throw new Error(`capture looks empty (${statSync(webm).size} bytes)`);
  }

  // Web-friendly mp4: yuv420p + faststart so it plays inline everywhere, and
  // an even-dimension filter because h264 rejects odd widths.
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      webm,
      '-vf',
      'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      mp4,
    ],
    { stdio: 'inherit' }
  );
  // Poster from ~3.5s in: the prompt is typed by then, so the still sells the
  // product instead of showing an empty box.
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-ss',
      '3.5',
      '-i',
      mp4,
      '-frames:v',
      '1',
      '-update',
      '1',
      '-q:v',
      '3',
      poster,
    ],
    { stdio: 'inherit' }
  );

  if (!keepWebm) rmSync(webm, { force: true });

  const mb = (statSync(mp4).size / 1e6).toFixed(2);
  console.log(`\nwrote frontend/public/demo/quicklook.mp4 (${mb} MB) + poster`);
};

run().catch((error) => {
  console.error(`\nrecord-demo failed: ${error.message}`);
  process.exit(1);
});
