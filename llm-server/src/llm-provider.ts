import { Response } from 'express';
import { Logger } from '@nestjs/common';
import { ConfigLoader, ModelConfig, ModelApiStreamChunk } from 'codefox-common';
import {
  ModelProviderType,
  ModelProviderOptions,
  ModelError,
  GenerateMessageParams,
  ModelInstance,
  ModelEngine,
  MessageInput,
} from './types';
import { RemoteModelFactory } from './model/remote-model-factory';

export class LLMProvider {
  private readonly logger = new Logger(LLMProvider.name);
  private readonly options: ModelProviderOptions;
  private initialized: boolean = false;
  private modelMap: Map<string, ModelInstance> = new Map();

  constructor(options: ModelProviderOptions = {}) {
    this.options = {
      maxConcurrentRequests: 5,
      maxRetries: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  private determineModelType(config: ModelConfig): ModelProviderType {
    if (config.endpoint && config.token) {
      return 'remote';
    }
    // Add more type determinations here
    // For example:
    // if (config.localPath) return 'local';

    throw new Error(
      `Unable to determine model type for config: ${config.model}`,
    );
  }

  async initialize(): Promise<void> {
    try {
      this.logger.log('Initializing LLM provider...');

      // Get all model configurations
      const config = ConfigLoader.getInstance();
      const chatModels = config.getAllChatModelConfigs();

      // Initialize engines and model instances for each configuration
      for (const modelConfig of chatModels) {
        try {
          // Determine model type
          const type = this.determineModelType(modelConfig);

          // Create model instance directly
          const modelKey = modelConfig.alias || modelConfig.model;
          switch (type) {
            case 'remote':
              const instance = await RemoteModelFactory.createInstance(
                modelConfig,
                modelConfig.model,
              );
              this.modelMap.set(modelKey, instance);
              break;
            // Add more cases for other model types
            default:
              throw new Error(`Unsupported model provider type: ${type}`);
          }

          this.logger.log(`Initialized model: ${modelKey} (${type})`);
        } catch (error) {
          this.logger.error(
            `Failed to initialize model ${modelConfig.model}:`,
            error,
          );
          // Continue with other models even if one fails
        }
      }

      this.initialized = true;
      this.logger.log('LLM provider fully initialized and ready.');
      this.logger.log(
        `Available models: ${Array.from(this.modelMap.keys()).join(', ')}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize LLM provider:', error);
      throw error;
    }
  }

  private getModelInstance(modelName: string): ModelInstance {
    this.ensureInitialized();

    const model = this.modelMap.get(modelName);
    if (!model) {
      const availableModels = Array.from(this.modelMap.keys()).join(', ');
      throw new Error(
        `Model '${modelName}' not found. Available models: ${availableModels}`,
      );
    }

    return model;
  }

  async chat(input: MessageInput, timeoutMs: number): Promise<string> {
    try {
      const model = this.getModelInstance(input.model);

      // Set a timeout dynamically based on the provided value
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(
          () => reject(new Error('Chat request timed out')),
          timeoutMs,
        ),
      );

      // Race between the actual model call and the timeout
      const completion = await Promise.race([
        model.chat(input.messages),
        timeoutPromise,
      ]);

      return (completion as any).choices[0].message.content || '';
    } catch (error) {
      this.logger.error(`Error in chat (Timeout: ${timeoutMs}ms):`, error);
      throw error;
    }
  }

  async *chatStream(
    input: MessageInput,
  ): AsyncIterableIterator<ModelApiStreamChunk> {
    try {
      const model = this.getModelInstance(input.model);
      yield* model.chatStream(input.messages);
    } catch (error) {
      this.logger.error('Error in chatStream:', error);
      throw error;
    }
  }

  async generateStreamingResponse(
    params: GenerateMessageParams,
    res: Response,
  ): Promise<void> {
    try {
      const model = this.getModelInstance(params.model);
      const stream = model.chatStream(params.messages);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      for await (const chunk of stream) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
      }

      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (error) {
      this.logger.error('Error in streaming response:', error);

      if (!res.writableEnded) {
        this.sendErrorResponse(res, error as ModelError);
      }
    }
  }

  async getModelTags(res: Response): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.log('Fetching available models from config...');
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const config = ConfigLoader.getInstance();
      const startTime = Date.now();
      const chatModels = config.getAllChatModelConfigs();
      const response = {
        models: {
          data: chatModels.map(model => ({
            id: model.alias || model.model,
            default: model.default || false,
          })),
        },
      };
      const endTime = Date.now();

      this.logger.log(
        `Models fetched: ${chatModels.length}, Time: ${endTime - startTime}ms`,
      );

      res.write(JSON.stringify(response));
      res.end();
    } catch (error) {
      this.logger.error('Error getting model tags:', error);

      if (!res.writableEnded) {
        const errorResponse = {
          error: {
            message: 'Failed to fetch models from config',
            code: 'FETCH_MODELS_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        };

        if (res.headersSent) {
          res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          res.status(500).json(errorResponse);
        }
      }
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LLM provider not initialized. Call initialize() first.');
    }
  }

  private sendErrorResponse(res: Response, error: ModelError): void {
    const errorResponse = {
      error: {
        message: error.message || 'Unknown error occurred',
        code: error.code || 'UNKNOWN_ERROR',
        details: error.details || error,
      },
    };

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.status(500).json(errorResponse);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getProviderOptions(): ModelProviderOptions {
    return { ...this.options };
  }

  getAvailableModels(): string[] {
    return Array.from(this.modelMap.keys());
  }
}
