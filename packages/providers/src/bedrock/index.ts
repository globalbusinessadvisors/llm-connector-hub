/**
 * AWS Bedrock Provider Module
 *
 * Exports all AWS Bedrock provider components:
 * - BedrockProvider - Main provider class
 * - Configuration types and utilities
 * - Error mapping utilities
 * - Request/response transformers
 * - Stream parsing utilities
 */

// Main provider
export { BedrockProvider, createBedrockProvider, createBedrockProviderFromEnv } from './BedrockProvider';
export type {
  CompletionRequest,
  CompletionResponse,
  HealthCheckResult,
} from './BedrockProvider';

// Configuration
export {
  validateBedrockConfig,
  mergeWithDefaults,
  getModelInfo,
  getModelProvider,
  supportsVision,
  supportsStreaming,
  supportsFunctionCalling,
  getMaxTokens,
  isValidModelArn,
  BedrockConfigError,
  BEDROCK_MODELS,
  BEDROCK_MODEL_INFO,
  DEFAULT_BEDROCK_CONFIG,
} from './BedrockConfig';
export type {
  BedrockConfig,
  BedrockModel,
  BedrockModelInfo,
  ModelProvider,
} from './BedrockConfig';

// Transformers
export {
  transformRequest,
  transformResponse,
  transformStreamChunk,
  ensureMaxTokens,
} from './BedrockTransformer';
export type {
  BedrockRequest,
  BedrockResponse,
  ClaudeBedrockRequest,
  ClaudeBedrockResponse,
  LlamaBedrockRequest,
  LlamaBedrockResponse,
  MistralBedrockRequest,
  MistralBedrockResponse,
} from './BedrockTransformer';

// Stream parser
export {
  parseBedrockStream,
  parseClaudeChunk,
  parseLlamaChunk,
  parseMistralChunk,
  parseStreamChunk,
  StreamAccumulator,
  eventStreamToAsyncIterable,
} from './BedrockStreamParser';
export type {
  BedrockStreamEvent,
  BedrockChunkEvent,
  BedrockMetadataEvent,
  BedrockErrorEvent,
  ClaudeStreamChunk,
  LlamaStreamChunk,
  MistralStreamChunk,
  ParsedStreamChunk,
} from './BedrockStreamParser';

// Error mapping
export {
  mapBedrockError,
  isRetryableError,
  isAuthenticationError,
  isRateLimitError,
  isServerError,
  formatErrorMessage,
  shouldRetry,
  calculateBackoff,
  getRetryDelay,
} from './BedrockErrorMapper';
export type {
  BedrockErrorCode,
  MappedError,
} from './BedrockErrorMapper';
