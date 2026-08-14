/**
 * Refuse to measure a page that is not actually running.
 *
 * Two separate nights were lost to this. A standalone build served without
 * its `static/` dir 404s the stylesheet: Tailwind never applies, every
 * element falls back to `display:inline`, and the geometry you measure is
 * real, reproducible, and about a page nobody will ever see — one such run
 * reported a hero image "overflowing at 1600px" that was simply an unstyled
 * `<img>`. A `next dev` whose webpack cache got clobbered (another agent
 * building into the same `.next`) serves a 500 shell rendering zero buttons,
 * which reads exactly like "the button is missing" — the bug you were
 * hunting.
 *
 * Both fail loudly here instead, because a screenshot of a broken rig is
 * worse than no screenshot: it looks like evidence.
 *
 * ponytail: two probes, no config. Buttons prove React mounted; a non-zero
 * border-radius proves the stylesheet landed. Everything else a broken rig
 * does downstream of those two is a symptom.
 */
export async function assertAlive(page, where) {
  const probe = await page.evaluate(() => ({
    buttons: document.querySelectorAll('button').length,
    styled: [...document.querySelectorAll('[class*="rounded"]')].some(
      (el) => getComputedStyle(el).borderRadius !== '0px'
    ),
  }));

  if (!probe.buttons) {
    throw new Error(
      `${where}: no buttons in the DOM — the app did not render. Check the ` +
        `server log; a clobbered .next serves a 500 shell. ` +
        `Fix: rm -rf .next and restart the server.`
    );
  }
  if (!probe.styled) {
    throw new Error(
      `${where}: stylesheet never applied — every measurement would be wrong. ` +
        `Fix: a standalone build needs .next/static copied next to server.js.`
    );
  }
}
