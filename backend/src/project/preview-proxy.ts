import { Logger } from '@nestjs/common';
import type { Express, Request, Response, NextFunction } from 'express';
import { PreviewService } from './preview.service';

/** Identifies which project's dev server unclaimed requests belong to. */
export const PREVIEW_COOKIE = 'codefox_preview';

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
    const projectPath = (req.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim().split('='))
      .find(([key]) => key === PREVIEW_COOKIE)?.[1];

    const port = projectPath ? previews.portFor(projectPath) : undefined;
    if (!port) return next();

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
