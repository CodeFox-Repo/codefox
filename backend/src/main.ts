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
    origin: '*',
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

  // After Nest's router, so a real route always wins and only unclaimed
  // paths — a preview's own assets — reach the proxy.
  mountPreviewProxy(
    app.getHttpAdapter().getInstance(),
    app.get(PreviewService),
  );

  console.log('process.env.PORT:', process.env.PORT);
  const server = await app.listen(process.env.PORT ?? 8080);
  logger.log(`Application is running on port ${process.env.PORT ?? 8080}`);

  // Handle shutdown signals
  const signals = ['SIGTERM', 'SIGINT'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.log(`Received ${signal} signal. Starting graceful shutdown...`);

      try {
        await app.close();
        await server.close();
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
