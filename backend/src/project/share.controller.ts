import { Controller, Get, Logger, Param, Req, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Project } from './project.model';
import { WorkspaceService } from './workspace.service';
import { publicOrigin, withSocialCard } from './social-card';
import { shareChrome, socialTagsFor } from './share-chrome';
import { sharedPagePath } from './shared-page-path';

/**
 * Serves a public page project as a real, linkable page.
 *
 * Until this route, a generated page could be downloaded as a zip or forked,
 * but never *shown*: the gallery had a screenshot, the preview pane rendered
 * into an srcdoc iframe, and even "open in new tab" was a blob url that dies
 * with the tab. Nothing a user could send to anyone. Making the thing they
 * built shareable is most of why they built it.
 *
 * Three things this route is careful about:
 *
 * - **Anonymous.** A share link that demands a login is not a share link.
 *   Only projects their owner has marked public are reachable, and only
 *   reading — nothing here touches the project.
 *
 * - **The id is `uniqueProjectId`, not `projectPath`.** The directory name is
 *   what every authenticated file route keys on; handing it out in a public
 *   url invites probing those. This is a separate uuid that already exists on
 *   the row and means nothing to the file APIs.
 *
 * - **The page is untrusted HTML on this origin.** It was written by a model
 *   following a stranger's prompt. `sandbox` on the response strips it of
 *   this origin's cookies and storage, so a shared page cannot read the
 *   session of whoever opens it.
 */
@Controller('share')
export class ShareController {
  private readonly logger = new Logger('ShareController');

  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    private readonly workspaces: WorkspaceService,
  ) {}

  // `:id/*` as a second route rather than an optional segment: this is Nest
  // 10 on Express 4, where the `*path` form silently matches nothing.
  @Get([':id', ':id/*'])
  @Public()
  async page(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // The public id is a uuid. Anything else is not worth a database round
    // trip, and this value is about to be used to look up a project.
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return this.notFound(res, 'That share link is not valid.');
    }

    const project = await this.projects.findOne({
      where: { uniqueProjectId: id, isDeleted: false },
      // Just the byline. `user` is the publisher's row, so only the username
      // is ever rendered — see share-chrome.
      relations: ['user'],
    });

    // One message for "no such project" and "not public": a shared link that
    // distinguishes them is a way to learn which private projects exist.
    if (!project?.isPublic) {
      return this.notFound(res, 'This page is not shared.');
    }

    // A Next app has no file to serve — it has a dev server. Boot its
    // sandbox via /api/live and send the visitor there; the page below is
    // the wait, since a cold microVM can take a minute.
    if (project.template !== 'html') {
      return res.send(this.bootingPage(project.projectName, id));
    }

    // A site is allowed more than one page — the agent is told to add
    // `.html` files and link between them — so a shared link has to be able
    // to follow those links. Without this, every `<a href="about.html">` the
    // agent was instructed to write led to a 404.
    const file = sharedPagePath(req.path, id);
    if (!file) {
      return this.notFound(res, 'That page is not part of this site.');
    }

    let html: string | null = null;
    try {
      const workspace = await this.workspaces.for(project.projectPath);
      html = await workspace.readFile(file);
    } catch (error) {
      this.logger.warn(`Share ${id}/${file} could not be read: ${error}`);
    }

    if (html === null) {
      return this.notFound(
        res,
        file === 'index.html'
          ? 'This page has not been built yet.'
          : 'That page is not part of this site.',
      );
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // The page runs its own scripts — that is the product — but as an opaque
    // origin, so it cannot reach cookies or storage belonging to the app.
    res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-forms');
    // Short: the owner keeps editing, and a shared link showing yesterday's
    // page would look broken to them.
    res.setHeader('Cache-Control', 'public, max-age=60');

    // The front door gets our chrome — a thin bar with the byline and a
    // Remix button — around the page in an iframe. Everything else (the
    // iframe's own request, and the site's other pages, which are reached by
    // links from inside that frame) is served bare, or every in-page link
    // would stack another bar.
    //
    // Both responses keep the sandbox CSP: the chrome is ours, but it is
    // still served from the origin a stranger's page runs on, and the header
    // costs nothing here.
    if (file === 'index.html' && req.query.raw === undefined) {
      return res.send(
        shareChrome({
          project,
          head: socialTagsFor(project, req),
          frameSrc: `/share/${id}?raw=1`,
          // The host the visitor actually used — in production `/share` is
          // rewritten from the app's own domain, so this IS the app. Falls
          // back to the configured frontend url, which is what makes the
          // links work when the backend is reached directly (dev).
          appOrigin: publicOrigin(req) || (process.env.FRONTEND_URL ?? ''),
        }),
      );
    }

    return res.send(withSocialCard(html, project, req));
  }

  private notFound(res: Response, message: string) {
    res.status(404);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(
      `<!doctype html><meta charset="utf-8"><title>Not shared</title>` +
        `<body style="font:16px/1.6 system-ui;display:grid;place-items:center;` +
        `min-height:100vh;margin:0;background:#141413;color:#e8e6dc">` +
        `<main style="text-align:center"><p>${message}</p></main>`,
    );
  }

  /**
   * The wait while an app's sandbox boots. Polls the live endpoint and
   * redirects when the dev server answers; gives up with a retry link after
   * three minutes, which is past any cold start we have measured.
   */
  private bootingPage(name: string, id: string) {
    const safe = name.replace(/[<>&"]/g, '');
    return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Starting ${safe} — CodeFox</title>
<body style="font:16px/1.6 system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#141413;color:#e8e6dc">
<main style="text-align:center;max-width:32rem;padding:0 1.5rem">
  <p style="font-family:ui-monospace,monospace;font-size:12px;letter-spacing:.12em;color:#c96a3a;text-transform:uppercase">Built with CodeFox</p>
  <h1 style="font-size:1.5rem;margin:.5rem 0">Starting ${safe}…</h1>
  <p id="s" style="color:#a8a59a">Waking the app up — a cold start can take up to a minute.</p>
</main>
<script>
const s = document.getElementById('s');
const deadline = Date.now() + 180000;
const tick = async () => {
  try {
    const r = await fetch('/api/live/${id}');
    if (r.ok) {
      const { url } = await r.json();
      if (url) { location.replace(url); return; }
    }
  } catch {}
  if (Date.now() > deadline) {
    s.textContent = 'This one is taking too long — ';
    const a = document.createElement('a');
    a.textContent = 'try again';
    a.href = '';
    a.style.color = '#c96a3a';
    s.appendChild(a);
    return;
  }
  setTimeout(tick, 3000);
};
tick();
</script>`;
  }
}
