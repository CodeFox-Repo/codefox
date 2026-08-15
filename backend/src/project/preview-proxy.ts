import { Logger } from '@nestjs/common';
import type { Express, Request, Response, NextFunction } from 'express';
import { PreviewService } from './preview.service';

/** Identifies which project's dev server unclaimed requests belong to. */
export const PREVIEW_COOKIE = 'codefox_preview';

/**
 * Paths this server answers itself, which the proxy must never take.
 *
 * The proxy has to run before Nest's router — Nest replies to an unmatched
 * path with its own 404 instead of calling next(), so anything mounted after
 * it is unreachable. Running first means every request carrying the preview
 * cookie went to the project's dev server, including the calls that make the
 * page work: /api/chat answered 404 and the chat never replied, /api/project
 * answered 404 and the file tree spun forever.
 *
 * Deliberately the specific routes rather than all of `/api`: a generated app
 * has its own API routes, and those are the preview's to serve.
 *
 * CASE-INSENSITIVE, and it has to be. Express 4 routes case-insensitively by
 * default, so `/API/chat` and `/GraphQL` reach Nest's handlers — but a
 * case-sensitive pattern here does not recognise them as ours, so the proxy
 * claimed them first and forwarded the request verbatim, `Authorization`
 * header and body included, into the project's dev server. That server runs
 * model-written code with this process's privileges, so a generated app with
 * a catch-all route was handed the visitor's bearer token.
 *
 * Every mounted controller prefix belongs in this list. `auth` and `api/test`
 * were missing outright, which is the same bug without needing the casing
 * trick.
 */
const OURS =
  /^\/(graphql|health|download|share|auth|api\/(chat|project|file|media|preview|screenshot|pdf|test|live))(\/|\?|$)/i;

const logger = new Logger('PreviewProxy');

/**
 * Serves a project's running dev server through this origin.
 *
 * A dev server binds to loopback, so handing the browser `127.0.0.1:<port>`
 * only works when browser and server are the same machine. Deployed, that
 * address is the user's own laptop and the iframe shows nothing.
 *
 * A path prefix cannot fix it: Next serves assets from absolute `/_next/*`
 * urls, so anything mounted under a prefix loads its HTML and then requests
 * chunks from the wrong place. So the proxy answers at the root and a cookie
 * says which project.
 *
 * Registered as middleware *after* Nest's router rather than as a catch-all
 * controller: a controller declared in AppModule is registered before every
 * child module, so `@All('*')` swallowed /graphql and /api wholesale.
 */
export const mountPreviewProxy = (app: Express, previews: PreviewService) => {
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (OURS.test(req.path)) return next();

    const projectPath = (req.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim().split('='))
      .find(([key]) => key === PREVIEW_COOKIE)?.[1];

    const port = projectPath ? previews.portFor(projectPath) : undefined;
    if (!port) return next();

    // Traffic through here is the only evidence that someone still has the
    // preview open; without it a user reading their own running app would
    // have it shut down underneath them on the idle sweep.
    previews.touch(projectPath!);

    const target = `http://127.0.0.1:${port}${req.originalUrl}`;
    try {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        // Host must be the upstream's own, and we terminate the encoding here.
        if (['host', 'accept-encoding', 'connection'].includes(key)) continue;
        if (typeof value === 'string') headers[key] = value;
      }

      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method)
          ? undefined
          : (req as unknown as { rawBody?: Buffer }).rawBody,
        redirect: 'manual',
      });

      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        if (!['content-encoding', 'transfer-encoding'].includes(key)) {
          res.setHeader(key, value);
        }
      });
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      logger.debug(`Proxy to ${target} failed: ${error}`);
      next();
    }
  });
};
