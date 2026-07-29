import {
  BadRequestException,
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response } from 'express';
import * as path from 'node:path';
import puppeteer, { Browser } from 'puppeteer';
import { getProjectsDir } from '../common/utils/common-path';
import { JWTAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceService } from './workspace.service';
import { Project } from './project.model';
import { assertProjectAccess } from './project-access';

/**
 * Screenshots a running preview, which is what gives a project its cover.
 *
 * This lived in the frontend, which only worked while both halves shared a
 * machine: a preview listens on 127.0.0.1 inside the backend's container, so
 * a browser launched anywhere else cannot reach it.
 */
@Controller('api')
@UseGuards(JWTAuthGuard)
export class ScreenshotController {
  private readonly logger = new Logger('ScreenshotController');
  private browser: Browser | null = null;

  constructor(
    private readonly workspaces: WorkspaceService,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

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

  /**
   * The one address this project may legitimately be rendered from.
   *
   * Derived, never accepted from the request: this used to take any `url` and
   * fetch it from inside the container, which made it a working proxy into
   * anything the box could reach — its own API on loopback included.
   */
  private async renderTarget(projectPath: string): Promise<string> {
    const workspace = await this.workspaces.for(projectPath);
    const running = await workspace.internalPreviewUrl();
    if (running) return running;

    // An html project has no server to render — its page is a file on this
    // machine (html projects live on the host in every mode), and the browser
    // can open a file directly.
    const project = await this.projects.findOne({ where: { projectPath } });
    if (project?.template === 'html') {
      return `file://${path.join(getProjectsDir(), projectPath, 'index.html')}`;
    }
    throw new BadRequestException('No preview is running for this project');
  }

  /** Open the page, hand it to `render`, and always close the tab. */
  private async withPage<T>(
    url: string,
    what: string,
    render: (page: Awaited<ReturnType<Browser['newPage']>>) => Promise<T>,
  ): Promise<T> {
    let page: Awaited<ReturnType<Browser['newPage']>> | null = null;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await page.setViewport({ width: 1600, height: 900 });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

      // Give the app a moment to paint. A capture of a blank frame is worse
      // than no capture at all.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return await render(page);
    } catch (error) {
      this.logger.error(`${what} of ${url} failed: ${error}`);
      // A browser that lost its target stays broken for every later request,
      // so drop it and let the next call launch a fresh one.
      if (
        /Target closed|Protocol error|Target\.createTarget/.test(String(error))
      ) {
        await this.browser?.close().catch(() => undefined);
        this.browser = null;
      }
      throw new InternalServerErrorException(`Failed to capture ${what}`);
    } finally {
      await page?.close().catch(() => undefined);
    }
  }

  @Get('screenshot')
  async screenshot(
    @Req() req: Request,
    @Query('projectPath') projectPath: string,
    @Res() res: Response,
  ) {
    await assertProjectAccess({
      projects: this.projects,
      req,
      projectPath,
      write: true,
    });

    const url = await this.renderTarget(projectPath);
    const shot = await this.withPage(url, 'screenshot', (page) =>
      page.screenshot({ type: 'png', fullPage: true }),
    );

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 's-maxage=3600');
    // Puppeteer hands back a Uint8Array, which Express does not recognise as
    // a body it should send verbatim — it JSON-encodes it into an object of
    // numbered bytes, so the cover arrived as text that no decoder accepts.
    res.send(Buffer.from(shot));
  }

  /**
   * The page as a PDF — what someone sends to a client or prints.
   *
   * A generated page is a deliverable, and a zip of HTML is not what anyone
   * hands over. The browser that already takes covers can print, so this is
   * the same pipeline with a different final call.
   */
  @Get('pdf')
  async pdf(
    @Req() req: Request,
    @Query('projectPath') projectPath: string,
    @Res() res: Response,
  ) {
    // Read access: unlike a screenshot, printing changes nothing, so a public
    // project can be printed by anyone who can already read it.
    const project = await assertProjectAccess({
      projects: this.projects,
      req,
      projectPath,
      write: false,
    });

    const url = await this.renderTarget(projectPath);
    const pdf = await this.withPage(url, 'pdf', (page) =>
      page.pdf({
        format: 'A4',
        // The page's own colours are the point — without this the print
        // stylesheet drops every background and a dark design comes out
        // blank.
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      }),
    );

    const name =
      (project.projectName || 'project').replace(/[^a-z0-9]+/gi, '_') || 'page';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.pdf"`);
    res.send(Buffer.from(pdf));
  }
}
