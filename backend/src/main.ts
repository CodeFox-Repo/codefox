import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';
import { graphqlUploadExpress } from 'graphql-upload-minimal';
import { json } from 'express';
import { PreviewService } from './project/preview.service';
import { mountPreviewProxy } from './project/preview-proxy';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  dotenv.config();

  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    // Reflected rather than `*`, and credentialed: the preview handshake sets
    // a cookie that the preview iframe — served from this origin — has to send
    // back. A wildcard origin makes the browser drop credentialed responses,
    // so the cookie was never stored and every deployed preview answered 404.
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Credentials',
      'Apollo-Require-Preflight',
      'x-refresh-token',
    ],
  });

  app.use(
    '/graphql',
    graphqlUploadExpress({ maxFileSize: 50000000, maxFiles: 10 }),
  );

  // Pasted screenshots reach /api/chat as base64 in the JSON body, which blows
  // straight past Express's 100kb default. Bounded by ArrayMaxSize(4) on the DTO.
  app.use(json({ limit: '25mb' }));

  // Necessarily *before* Nest's router: Nest answers an unmatched path with
  // its own 404 rather than calling next(), so a proxy mounted after it never
  // runs. Being first means it must decline this server's own routes itself —
  // see OURS in preview-proxy.
  mountPreviewProxy(
    app.getHttpAdapter().getInstance(),
    app.get(PreviewService),
  );

  console.log('process.env.PORT:', process.env.PORT);
  // The old `await server.close()` after `app.close()` was a no-op: Nest's
  // close already shuts the http server down, and `http.Server.close()`
  // returns the server rather than a promise.
  await app.listen(process.env.PORT ?? 8080);
  logger.log(`Application is running on port ${process.env.PORT ?? 8080}`);

  // Handle shutdown signals
  //
  // Bounded, because `app.close()` waits for every in-flight request to end
  // and an agent turn holds its ndjson response open for 9-10 minutes. The
  // platform's grace period is far shorter, so an unbounded close does not
  // buy a clean exit — it just guarantees the SIGKILL lands mid-write, at a
  // moment we did not choose. Exiting on our own terms is strictly better.
  //
  // ponytail: a timeout, not connection draining. `forceCloseConnections` on
  // NestFactory.create would sever live turns immediately, which is worse for
  // the common case (a deploy while someone is mid-build); this gives them a
  // window and then goes. The client already survives a dropped connection —
  // the backend rescue-saves the partial reply — so the deadline costs the
  // turn, not the answer.
  const SHUTDOWN_MS = 15_000;
  let closing = false;
  const signals = ['SIGTERM', 'SIGINT'];
  for (const signal of signals) {
    process.on(signal, async () => {
      // A second signal during a slow close used to start a second teardown
      // over the top of the first.
      if (closing) return;
      closing = true;
      logger.log(`Received ${signal} signal. Starting graceful shutdown...`);

      const deadline = setTimeout(() => {
        logger.warn(
          `Shutdown still going after ${SHUTDOWN_MS}ms — exiting anyway.`,
        );
        process.exit(0);
      }, SHUTDOWN_MS);
      // Nothing to wait for if the close finishes first.
      deadline.unref?.();

      try {
        await app.close();
        logger.log('Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  }
}

bootstrap().catch((error) => {
  console.error('Fatal error during application startup:', error);
  process.exit(1);
});
