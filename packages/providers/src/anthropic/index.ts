/**
 * Anthropic Provider Module
 *
 * Exports all Anthropic provider components:
 * - AnthropicProvider - Main provider class
 * - Configuration types and utilities
 * - Error mapping utilities
 * - Request/response transformers
 * - Stream parsing utilities
 */

// Main provider
export { AnthropicProvider, createAnthropicProvider } from './AnthropicProvider';
export type {
  CompletionRequest,
  CompletionResponse,
  HealthCheckResult,
} from './AnthropicProvider';

// Configuration
export {
  validateAnthropicConfig,
  mergeWithDefaults,
  getModelInfo,
  supportsVision,
  supportsStreaming,
  getMaxTokens,
  AnthropicConfigError,
  ANTHROPIC_MODELS,
  ANTHROPIC_MODEL_INFO,
  DEFAULT_ANTHROPIC_CONFIG,
} from './AnthropicConfig';
export type {
  AnthropicConfig,
  AnthropicModel,
  AnthropicModelInfo,
} from './AnthropicConfig';

// Transformers
export {
  transformMessages,
  transformResponse,
  transformStreamEvent,
  StreamAccumulator,
  ensureMaxTokens,
} from './AnthropicTransformer';
export type {
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicTextBlock,
  AnthropicImageBlock,
  AnthropicToolUseBlock,
  AnthropicToolResultBlock,
  AnthropicRequest,
  AnthropicResponse,
  AnthropicStreamEvent,
} from './AnthropicTransformer';

// Stream parser
export {
  parseSSEStream,
  parseSSEStreamNode,
  parseSSEString,
  parseStreamingResponse,
  isValidStreamEvent,
  SSEParseError,
} from './AnthropicStreamParser';
export type { SSEEvent } from './AnthropicStreamParser';

// Error mapping
export {
  mapAnthropicError,
  isRetryableError,
  isAuthenticationError,
  isRateLimitError,
  isServerError,
  formatErrorMessage,
  shouldRetry,
  calculateBackoff,
  getRetryDelay,
} from './AnthropicErrorMapper';
export type {
  AnthropicError,
  AnthropicErrorType,
  MappedError,
} from './AnthropicErrorMapper';
