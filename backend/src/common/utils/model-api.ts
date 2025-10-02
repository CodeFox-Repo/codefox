import OpenAI from 'openai';

// Core types from OpenAI API
export type ModelApiMessage = OpenAI.Chat.ChatCompletionMessageParam;
export type ModelApiRequest = OpenAI.Chat.ChatCompletionCreateParams;
export type ModelApiResponse = OpenAI.Chat.ChatCompletion;
export type ModelApiStreamChunk = OpenAI.Chat.ChatCompletionChunk;

// Additional useful types
export type ModelApiRole = OpenAI.Chat.ChatCompletionRole;
export type ModelApiFunction = OpenAI.Chat.ChatCompletionCreateParams.Function;
export type ModelApiFunctionCall =
  OpenAI.Chat.ChatCompletionMessage.FunctionCall;

// Error types
export type ModelApiError = InstanceType<typeof OpenAI.APIError>;
export type ModelApiErrorCode =
  | 'rate_limit_exceeded'
  | 'invalid_request_error'
  | 'api_error';
