#!/usr/bin/env node
/*
 * Records the README demo by driving the real product end to end: type a
 * prompt on the landing page, answer the agent's question card, wait for the
 * build, look at the result. Same idea as record-demo.mjs — a scripted,
 * re-runnable capture rather than a hand-made screen recording — but this one
 * films the whole loop instead of the landing page.
 *
 * A real build takes minutes and a README video may not. The script records
 * at real speed and then compresses the waiting: the beats it timestamps
 * while driving become ffmpeg trim/setpts segments, so typing and the reveal
 * stay at 1x and the two stretches where a human would only be watching the
 * agent work run fast, labelled with the speed on screen.
 *
 * Usage:  pnpm dev                      (in another terminal, with a working
 *                                        LLM_API_KEY — this spends real tokens)
 *         pnpm demo:flow
 *         pnpm demo:flow -- --prompt "a pricing page" --keep-raw
 *
 * Needs ffmpeg twice over: puppeteer shells out to it to screencast, and the
 * edit is one more invocation. `--ffmpeg /path/to/ffmpeg` covers the edit on a
 * machine without a system install; the capture needs it on PATH either way,
 * which `PATH=$(dirname $(node -p "require('ffmpeg-static')")):$PATH` gives you
 * without root.
 *
 * ponytail: puppeteer's screencast + one ffmpeg filter_complex. No editor, no
 * frame pipeline — the beats are known because the script caused them.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// puppeteer is a backend dependency and pnpm does not hoist, so a bare import
// from the repo root does not resolve. Ask backend's resolver for it.
const fromBackend = createRequire(join(root, 'backend/package.json'));
const puppeteer = (await import(pathToFileURL(fromBackend.resolve('puppeteer')))).default;
const outDir = join(root, 'assets');
const raw = join(outDir, 'demo-raw.webm');
const mp4 = join(outDir, 'demo.mp4');
const poster = join(outDir, 'demo-poster.jpg');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const url = arg('url', 'http://localhost:3000');
const api = arg('api', 'http://localhost:8080');
const prompt = arg('prompt', 'An analytics dashboard with KPI cards and a line chart');
const keepRaw = process.argv.includes('--keep-raw');
const ffmpeg = arg('ffmpeg', 'ffmpeg');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const started = Date.now();
const say = (m) => console.log(`${String((Date.now() - started) / 1000).padStart(6)}s  ${m}`);

/* ── the account ──────────────────────────────────────────────────────────
 * The dev credentials frontend/.env already carries, so the recording needs
 * no account of its own and no secret lives in this file.
 */
const devEnv = () => {
  const file = join(root, 'frontend/.env');
  if (!existsSync(file)) throw new Error('frontend/.env missing — run pnpm dev once');
  const read = (key) =>
    readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();
  const email = read('NEXT_PUBLIC_DEV_EMAIL');
  const password = read('NEXT_PUBLIC_DEV_PASSWORD');
  if (!email || !password) throw new Error('NEXT_PUBLIC_DEV_EMAIL/PASSWORD not in frontend/.env');
  return { email, password };
};

const gql = async (query, token) => {
  const res = await fetch(`${api}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query }),
  });
  return res.json();
};

/** The page as the backend has it right now, or null before it exists. */
const pageBytes = async (projectPath, token) => {
  const res = await fetch(`${api}/api/file?path=${encodeURIComponent(`${projectPath}/index.html`)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json())?.content?.length ?? null;
};

const signIn = async ({ email, password }) => {
  const login = `mutation{login(input:{email:"${email}",password:"${password}"}){accessToken refreshToken}}`;
  let { data } = await gql(login);
  if (!data?.login) {
    await gql(
      `mutation{registerUser(input:{username:"demo",email:"${email}",password:"${password}",confirmPassword:"${password}"}){id}}`
    );
    ({ data } = await gql(login));
  }
  if (!data?.login) throw new Error(`cannot sign in as ${email}`);
  return data.login;
};

/* ── driving ──────────────────────────────────────────────────────────── */

const buttonMatching = async (page, re) => {
  for (const handle of await page.$$('button')) {
    const text = (await page.evaluate((el) => el.textContent?.trim() ?? '', handle)) || '';
    if (re.test(text)) return handle;
  }
  return null;
};

/** A turn is running while the composer says so. */
const composerBusy = (page) =>
  page.evaluate(() => {
    const composer = document.querySelector('textarea');
    return (
      /keep typing/i.test(composer?.placeholder ?? '') ||
      Boolean(document.querySelector('[aria-label*="stop the agent" i]'))
    );
  });

/**
 * The build is over when the turn has ended AND the page has stopped growing.
 *
 * Either signal alone films the wrong thing. File size alone stops at the last
 * write, while the agent is still checking its work — the recording then ends
 * on the scaffold, because the preview only reloads once the turn does. The
 * composer alone can stay stuck in its streaming state after a stream dies.
 * Requiring both, twice in a row, is what makes the last shot the built page.
 */
const waitForSettle = async (page, projectPath, token, { minMs, quietMs, maxMs }) => {
  const deadline = Date.now() + maxMs;
  const floor = Date.now() + minMs;
  let last = await pageBytes(projectPath, token);
  let lastChange = Date.now();
  let grew = false;
  let quiet = 0;
  while (Date.now() < deadline) {
    await sleep(5000);
    const now = await pageBytes(projectPath, token);
    if (now !== last) {
      grew ||= now > (last ?? 0);
      last = now;
      lastChange = Date.now();
    }
    const still = !(await composerBusy(page)) && Date.now() - lastChange > quietMs;
    quiet = still ? quiet + 1 : 0;
    if (grew && quiet >= 2 && Date.now() > floor) return true;
  }
  return false;
};

const run = async () => {
  mkdirSync(outDir, { recursive: true });
  const auth = await signIn(devEnv());

  const browser = await puppeteer.launch({
    headless: true, // new headless — the old shell cannot screencast
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ['--force-color-profile=srgb', '--hide-scrollbars'],
  });

  const beats = {};
  let clock = 0;
  const beat = (name) => {
    beats[name] = (Date.now() - clock) / 1000;
    say(`beat ${name} @${beats[name].toFixed(1)}s`);
  };

  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => say(`pageerror: ${e.message}`));
    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem('accessToken', t.accessToken);
      localStorage.setItem('refreshToken', t.refreshToken);
    }, auth);
    // The floating dev auth toggle is a dev-environment artifact, not product.
    await page.evaluateOnNewDocument(() => {
      const hide = () => {
        const style = document.createElement('style');
        style.textContent = '[aria-label*="dev" i]{display:none !important}';
        document.head.appendChild(style);
      };
      document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', hide)
        : hide();
    });

    const response = await page.goto(url, { waitUntil: 'networkidle2' });
    if (!response?.ok()) throw new Error(`${url} responded ${response?.status()}`);
    await page.waitForSelector('textarea', { timeout: 90_000 });
    await sleep(2000);

    const recorder = await page.screencast({ path: raw });
    clock = Date.now();
    await sleep(1400);

    await page.click('textarea');
    await page.type('textarea', prompt, { delay: 45 });
    await sleep(1200);
    (await buttonMatching(page, /^create$/i))?.click();
    beat('create');

    await page.waitForFunction(() => location.pathname === '/chat', { timeout: 120_000 });
    await sleep(3500);
    beat('workbench');

    const chatId = new URL(page.url()).searchParams.get('id');
    const details = await gql(
      `{getChatDetails(chatId:"${chatId}"){project{projectPath}}}`,
      auth.accessToken
    );
    const projectPath = details?.data?.getChatDetails?.project?.projectPath;
    if (!projectPath) throw new Error(`no project behind chat ${chatId}`);

    // First turn is the agent's question block — the product asks before it builds.
    await page.waitForFunction(() => /before building/i.test(document.body.innerText), {
      timeout: 300_000,
      polling: 1500,
    });
    await sleep(2500);
    beat('questions');

    const groups = await page.$$('div.space-y-4 > div');
    const wanted = [0, 1, 0, 1];
    let index = 0;
    for (const group of groups) {
      const options = await group.$$('button[aria-pressed]');
      if (!options.length) continue;
      await options[Math.min(wanted[index] ?? 0, options.length - 1)].click();
      index++;
      await sleep(1100);
    }
    await sleep(1000);
    (await buttonMatching(page, /start building/i))?.click();
    beat('building');

    const settled = await waitForSettle(page, projectPath, auth.accessToken, {
      minMs: 60_000,
      quietMs: 20_000,
      maxMs: 20 * 60_000,
    });
    if (!settled) say('WARNING: agent still working at the cap — filming the reveal anyway');

    // Ask the preview for the page as it is now. It reloads on its own when a
    // turn ends, but the recording should not depend on catching that.
    const refresh = await page.$('[aria-label="Refresh preview"]');
    await refresh?.click();
    await sleep(6000);
    beat('built');

    // The reveal: the built page, a scroll through it, then the file behind it.
    //
    // By title, not "the first frame that is not the main one" — in dev that
    // one is Next's error overlay, and scrolling it looks exactly like a page
    // that does not scroll. The preview can also reload underneath us, which
    // detaches the frame mid-evaluate; a reveal is not worth failing a
    // seven-minute recording over.
    await sleep(2500);
    try {
      const frame = await (await page.$('iframe[title="preview"]'))?.contentFrame();
      await frame?.evaluate(
        () =>
          new Promise((done) => {
            const target = Math.min(1400, document.body.scrollHeight - innerHeight);
            const start = performance.now();
            const step = (now) => {
              const t = Math.min(1, (now - start) / 4200);
              scrollTo(0, target * (1 - Math.pow(1 - t, 3)));
              t < 1 ? requestAnimationFrame(step) : done();
            };
            requestAnimationFrame(step);
          })
      );
    } catch (error) {
      say(`preview scroll skipped: ${error.message}`);
    }
    await sleep(1500);
    (await buttonMatching(page, /^code$/i))?.click();
    await sleep(4500);
    (await buttonMatching(page, /^preview$/i))?.click();
    await sleep(3000);
    beat('end');

    await recorder.stop();
    await page.close();
  } finally {
    await browser.close();
  }

  if (statSync(raw).size < 10_000) throw new Error(`capture looks empty (${statSync(raw).size} bytes)`);
  writeFileSync(join(outDir, 'demo-beats.json'), `${JSON.stringify(beats, null, 2)}\n`);
  await edit(beats);
};

/* ── editing ──────────────────────────────────────────────────────────────
 * One filter graph: trim each stretch, scale its PTS, concat. The fast
 * stretches carry a badge so the speed-up is visible, not implied.
 *
 * The badge is a PNG rendered in the same browser rather than ffmpeg's
 * drawtext: a static ffmpeg build usually ships without libfreetype, and a
 * demo recorder that dies on the label is worse than one that draws it the
 * long way. It also gets the product's own type instead of a system font.
 */
const badgeFor = async (browser, text, file) => {
  const page = await browser.newPage();
  // Screencast captures CSS pixels, so the badge is authored at 1x against a
  // 1440-wide frame. Rendered at 2x it lands three times the size it should.
  await page.setViewport({ width: 600, height: 120, deviceScaleFactor: 1 });
  await page.setContent(
    `<body style="margin:0;background:transparent">
       <div style="display:inline-block;padding:7px 13px;border-radius:8px;
                   background:rgba(12,12,14,.72);color:#fff;
                   font:600 15px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;
                   letter-spacing:.04em">${text}</div>
     </body>`
  );
  const box = await (await page.$('div')).boundingBox();
  await page.screenshot({ path: file, omitBackground: true, clip: { ...box, x: 0, y: 0 } });
  await page.close();
};

const edit = async (beats) => {
  const plan = [
    { from: 0, to: beats.workbench, rate: 1 },
    { from: beats.workbench, to: beats.questions, rate: 6, label: 'agent thinking' },
    { from: beats.questions, to: beats.building, rate: 1.6 },
    { from: beats.building, to: beats.built, rate: 12, label: 'agent building' },
    { from: beats.built, to: beats.end, rate: 1 },
  ].filter((s) => s.to - s.from > 0.4);

  const labelled = plan.filter((s) => s.label);
  const badges = labelled.map((_, i) => join(outDir, `.demo-badge-${i}.png`));
  if (labelled.length) {
    const browser = await puppeteer.launch({ headless: true });
    try {
      for (const [i, seg] of labelled.entries()) {
        await badgeFor(browser, `${seg.label} &nbsp;${seg.rate}×`, badges[i]);
      }
    } finally {
      await browser.close();
    }
  }

  const parts = plan.map((seg, i) => {
    const trimmed =
      `[0:v]trim=start=${seg.from.toFixed(2)}:end=${seg.to.toFixed(2)},` +
      `setpts=(PTS-STARTPTS)/${seg.rate}`;
    const badge = labelled.indexOf(seg);
    return badge === -1
      ? `${trimmed}[v${i}]`
      // Bottom right: the top right is the workbench's own toolbar, and a
      // badge sitting on the Notes and PDF buttons reads as part of the app.
      : `${trimmed}[t${i}];[t${i}][${badge + 1}:v]overlay=x=W-w-28:y=H-h-28[v${i}]`;
  });
  // Where the reveal starts once every earlier stretch has been compressed.
  const revealAt = plan
    .slice(0, -1)
    .reduce((total, seg) => total + (seg.to - seg.from) / seg.rate, 0);
  const posterAt = revealAt + 8;

  // Captured at deviceScaleFactor 2 and delivered at 1x: the downscale is
  // what makes text in the video look like text rather than like pixels.
  const graph =
    `${parts.join(';')};${plan.map((_, i) => `[v${i}]`).join('')}` +
    `concat=n=${plan.length}:v=1:a=0,scale=1440:-2[out]`;

  execFileSync(
    ffmpeg,
    [
      '-y', '-i', raw,
      ...badges.flatMap((b) => ['-i', b]),
      '-filter_complex', graph,
      '-map', '[out]',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', '-an',
      mp4,
    ],
    { stdio: 'inherit' }
  );
  execFileSync(
    ffmpeg,
    // A few seconds into the reveal: the still that stands in for the video
    // should be the page the agent built, not an empty prompt box.
    ['-y', '-ss', String(posterAt.toFixed(1)), '-i', mp4, '-frames:v', '1', '-update', '1', '-q:v', '3', poster],
    { stdio: 'inherit' }
  );
  if (!keepRaw) rmSync(raw, { force: true });
  for (const badge of badges) rmSync(badge, { force: true });

  const mb = (statSync(mp4).size / 1e6).toFixed(2);
  console.log(`\nwrote assets/demo.mp4 (${mb} MB) + assets/demo-poster.jpg`);
};

run().catch((error) => {
  console.error(`\nrecord-flow failed: ${error.message}`);
  process.exit(1);
});
