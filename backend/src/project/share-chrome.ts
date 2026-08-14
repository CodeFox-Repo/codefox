import type { Project } from './project.model';
import { withSocialCard } from './social-card';

/**
 * The thin bar above a shared page, and the frame that holds the page itself.
 *
 * The generated HTML is untrusted — a model wrote it from a stranger's
 * prompt — so it cannot simply gain a Remix button: anything injected into
 * that document runs under its `sandbox` CSP, where a link cannot navigate
 * the top window and does nothing at all. Wrapping instead of injecting is
 * what makes the button work: the chrome is OUR html on our origin, and the
 * page keeps its sandbox inside an iframe.
 *
 * ponytail: a string template, not a view engine. This is one page with
 * three links; the whole file is smaller than the config a renderer needs.
 */

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string,
  );

/**
 * The og/twitter tags for a project, as markup for the outer page.
 *
 * Reuses `withSocialCard` rather than rebuilding the tag list: it owns the
 * twin-spelling rules, the forwarded-host logic and the `$`-injection fix,
 * and a second copy here would drift from all three. Feeding it a bare
 * `<head>` and taking what it added is smaller than exporting its internals.
 */
export function socialTagsFor(
  project: Parameters<typeof withSocialCard>[1],
  req: Parameters<typeof withSocialCard>[2],
): string {
  const stub = '<head></head>';
  return withSocialCard(stub, project, req).slice(
    '<head>'.length,
    -'</head>'.length,
  );
}

/**
 * `head` carries the og/twitter tags, already built and escaped by
 * social-card. They belong in THIS document now — a crawler reads the outer
 * page, never the framed one.
 */
export function shareChrome({
  project,
  head,
  frameSrc,
  appOrigin,
}: {
  project: Pick<Project, 'id' | 'projectName' | 'uniqueProjectId'> & {
    user?: { username?: string } | null;
    subNumber?: number | null;
  };
  head: string;
  frameSrc: string;
  appOrigin: string;
}): string {
  const name = escapeHtml(project.projectName ?? 'A page');
  const author = project.user?.username
    ? `by ${escapeHtml(project.user.username)}`
    : '';
  // Only when someone has actually remixed it: "0 remixes" is noise that
  // makes a new page look ignored.
  const remixes = project.subNumber
    ? `· ${project.subNumber} remix${project.subNumber === 1 ? '' : 'es'}`
    : '';
  // The gallery is where remixing already works, signed in or not — it says
  // "sign in to remix" when you are not. Sending people there is one link
  // instead of a second auth flow living in this file.
  //
  // The ROW id, not the share id: the landing page has to resolve this to
  // something forkable, and the wall it searches only holds the newest few
  // projects. Keyed by share id, remixing anything older silently did
  // nothing. forkProject takes this id, so handing it over directly needs no
  // lookup at all.
  const remix = `${appOrigin}/?remix=${encodeURIComponent(project.id)}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — CodeFox</title>
<!-- Forwarded links collect ?utm_source=… and friends; without this each
     variant is a separate url to a crawler, splitting the page against
     itself. Points at the clean share url, which is also the one the Remix
     button and the sitemap use. -->
<link rel="canonical" href="${appOrigin}/share/${encodeURIComponent(project.uniqueProjectId)}">
${head}
<style>
  /* The app's own tokens, inlined: this page is served by the backend, so
     it cannot reach globals.css. Dark is the designed theme and the default
     here; a visitor whose OS asks for light gets the same paper palette the
     app uses rather than a dark slab in a light browser. */
  :root {
    color-scheme: dark light;
    --bar: #1a1614; --edge: #2b2622; --ink: #f3ede7;
    --dim: #9b8f86; --brand: #c96a3a; --on-brand: #14110f;
    --page: #14110f;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bar: #ffffff; --edge: #e4e0d5; --ink: #141413;
      --dim: #6b655c; --brand: #b0532f; --on-brand: #faf9f5;
      --page: #faf9f5;
    }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; flex-direction: column;
    background: var(--page); color: var(--ink);
    font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  header {
    display: flex; align-items: center; gap: 12px;
    padding: 8px 14px; border-bottom: 1px solid var(--edge);
    background: var(--bar);
  }
  .name { font-weight: 600; white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; }
  .by { color: var(--dim); white-space: nowrap; }
  .spacer { flex: 1 1 auto; }
  a { color: inherit; text-decoration: none; }
  .remix {
    padding: 5px 12px; border: 1px solid var(--brand); border-radius: 6px;
    background: var(--brand); color: var(--on-brand); font-weight: 600; white-space: nowrap;
  }
  .remix:hover { filter: brightness(1.08); }
  .built { color: var(--dim); white-space: nowrap; }
  .built:hover { color: var(--ink); }
  /* The framed page paints its own background; this is only what shows for
     the instant before it loads, so it follows the theme rather than
     flashing white on a dark page. */
  iframe { flex: 1 1 auto; width: 100%; border: 0; background: var(--page); }
  @media (max-width: 520px) { .by, .built { display: none; } }
</style>
</head>
<body>
<header>
  <span class="name">${name}</span>
  <span class="by">${author} ${remixes}</span>
  <span class="spacer"></span>
  <a class="remix" href="${remix}">Remix</a>
  <a class="built" href="${appOrigin}/">Built with CodeFox</a>
</header>
<!-- The page keeps its own sandbox: scripts run (that is the product) but it
     cannot reach this document, its storage, or navigate the top window.
     allow-same-origin is deliberately absent — with allow-scripts it would
     hand the page the right to remove its own sandbox. -->
<iframe src="${frameSrc}" title="${name}"
        sandbox="allow-scripts allow-forms allow-popups"></iframe>
</body>
</html>`;
}
