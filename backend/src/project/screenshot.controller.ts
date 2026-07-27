import {
  BadRequestException,
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import puppeteer, { Browser } from 'puppeteer';
import { PreviewService } from './preview.service';

/**
 * Screenshots a running preview, which is what gives a project its cover.
 *
 * This lived in the frontend, which only worked while both halves shared a
 * machine: a preview listens on 127.0.0.1 inside the backend's container, so
 * a browser launched anywhere else cannot reach it.
 */
@Controller('api')
export class ScreenshotController {
  private readonly logger = new Logger('ScreenshotController');
  private browser: Browser | null = null;

  constructor(private readonly previews: PreviewService) {}

  /** One browser for the process; launching per request costs seconds. */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.logger.log('Launching headless browser');
      this.browser = await puppeteer.launch({
        headless: true,
        protocolTimeout: 240_000,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  @Get('screenshot')
  async screenshot(
    @Query('url') url: string,
    @Query('projectPath') projectPath: string | undefined,
    @Res() res: Response,
  ) {
    // Prefer the project's own dev server. The caller's `url` is this origin,
    // which only resolves to a preview when the request carries the preview
    // cookie — and a browser launched here has no cookie, so every cover came
    // out as a shot of the API root. The dev server is on this machine, so
    // loopback is both reachable and unambiguous.
    if (projectPath) {
      const port = this.previews.portFor(projectPath);
      if (port) url = `http://127.0.0.1:${port}`;
      else this.logger.warn(`No running preview for ${projectPath}`);
    }

    if (!url) throw new BadRequestException('url is required');

    let page: Awaited<ReturnType<Browser['newPage']>> | null = null;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await page.setViewport({ width: 1600, height: 900 });
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });

      // Give the app a moment to paint. A cover of a blank frame is worse
      // than no cover at all.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const shot = await page.screenshot({ type: 'png', fullPage: true });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 's-maxage=3600');
      // Puppeteer hands back a Uint8Array, which Express does not recognise as
      // a body it should send verbatim — it JSON-encodes it into an object of
      // numbered bytes, so the cover arrived as text that no decoder accepts.
      res.send(Buffer.from(shot));
    } catch (error) {
      this.logger.error(`Screenshot of ${url} failed: ${error}`);
      // A browser that lost its target stays broken for every later request,
      // so drop it and let the next call launch a fresh one.
      if (
        /Target closed|Protocol error|Target\.createTarget/.test(String(error))
      ) {
        await this.browser?.close().catch(() => undefined);
        this.browser = null;
      }
      throw new InternalServerErrorException('Failed to capture screenshot');
    } finally {
      await page?.close().catch(() => undefined);
    }
  }
}
