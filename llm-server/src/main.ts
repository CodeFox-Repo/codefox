import { Logger } from '@nestjs/common';
import { LLMProvider } from './llm-provider';
import express, { Express, Request, Response, NextFunction } from 'express';
import { downloadAll } from './downloader/universal-utils';
import { MessageInput } from './types';

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  if (reason instanceof Error) {
    console.error('Stack trace:', reason.stack);
  }
  process.exit(1);
});

export class App {
  private readonly logger = new Logger(App.name);
  private app: Express;
  private readonly PORT: number;
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.app = express();
    this.app.use(express.json());
    this.PORT = parseInt(process.env.PORT || '3001', 10);
    this.llmProvider = llmProvider;
    this.logger.log(`App initialized with PORT: ${this.PORT}`);

    this.app.use(
      (err: Error, req: Request, res: Response, next: NextFunction) => {
        this.logger.error('Global error handler caught:', err);
        console.error('Stack trace:', err.stack);
        res.status(500).json({
          error: 'Internal server error',
          message: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        });
      },
    );
  }

  setupRoutes(): void {
    this.logger.log('Setting up routes...');
    this.app.post('/chat/completions', this.handleChatRequest.bind(this));
    this.app.get('/tags', this.handleModelTagsRequest.bind(this));
    this.app.get('/models', this.handleModelTagsRequest.bind(this));
    this.logger.log('Routes set up successfully.');
  }

  private async handleChatRequest(req: Request, res: Response): Promise<void> {
    this.logger.log('Received chat request.');
    try {
      const input = req.body as MessageInput & { stream?: boolean };
      const model = input.model;
      this.logger.log(`Received chat request for model: ${model}`);
      this.logger.debug(
        `Request messages: "${JSON.stringify(input.messages).slice(0, 100)}"`,
      );

      if (input.stream) {
        // Handle streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        this.logger.debug('Response headers set for streaming.');

        const stream = this.llmProvider.chatStream(input);
        for await (const chunk of stream) {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        }

        if (!res.writableEnded) {
          res.write('data: [DONE]\n\n');
          res.end();
        }
      } else {
        // Handle regular response
        const response = await this.llmProvider.chat(input);
        res.json({
          model: input.model,
          choices: [
            {
              message: {
                role: 'assistant',
                content: response,
              },
            },
          ],
        });
      }
    } catch (error) {
      this.logger.error('Error in chat endpoint:', error);
      console.error(
        'Stack trace:',
        error instanceof Error ? error.stack : error,
      );
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack:
          process.env.NODE_ENV === 'development'
            ? error instanceof Error
              ? error.stack
              : undefined
            : undefined,
      });
    }
  }

  private async handleModelTagsRequest(
    req: Request,
    res: Response,
  ): Promise<void> {
    this.logger.log('Received tags request.');
    try {
      this.logger.debug(JSON.stringify(req.body));
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      this.logger.debug('Response headers set for streaming.');
      await this.llmProvider.getModelTags(res);
    } catch (error) {
      this.logger.error('Error in tags endpoint:', error);
      console.error(
        'Stack trace:',
        error instanceof Error ? error.stack : error,
      );
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack:
          process.env.NODE_ENV === 'development'
            ? error instanceof Error
              ? error.stack
              : undefined
            : undefined,
      });
    }
  }

  async start(): Promise<void> {
    try {
      this.setupRoutes();
      this.app.listen(this.PORT, () => {
        this.logger.log(`Server running on port ${this.PORT}`);
      });
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      console.error(
        'Stack trace:',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}

async function main() {
  const logger = new Logger('Main');
  try {
    logger.log('Starting application initialization...');
    await downloadAll();
    logger.log('Models downloaded successfully.');

    const llmProvider = new LLMProvider();
    await llmProvider.initialize();
    logger.log('LLM provider initialized successfully.');

    const app = new App(llmProvider);
    await app.start();
    logger.log('Application started successfully.');
  } catch (error) {
    logger.error('Failed to start the application:', error);
    logger.error('Stack trace:', error instanceof Error ? error.stack : error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error during application startup:');
  console.error(error);
  console.error('Stack trace:', error instanceof Error ? error.stack : error);
  process.exit(1);
});
