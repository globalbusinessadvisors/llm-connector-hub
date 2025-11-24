/**
 * OpenAI Provider Module
 *
 * Exports all OpenAI provider components for use in the LLM Connector Hub.
 */

// Provider
export {
  OpenAIProvider,
  createOpenAIProvider,
  createOpenAIProviderFromEnv,
  type CompletionRequest,
  type CompletionResponse,
  type HealthCheckResult,
} from './OpenAIProvider';

// Configuration
export {
  type OpenAIConfig,
  type OpenAIModel,
  type OpenAIModelInfo,
  OpenAIConfigError,
  OPENAI_MODELS,
  OPENAI_MODEL_INFO,
  DEFAULT_OPENAI_CONFIG,
  validateOpenAIConfig,
  mergeWithDefaults,
  getModelInfo,
  supportsVision,
  supportsFunctionCalling,
  supportsStreaming,
  getMaxTokens,
} from './OpenAIConfig';

// Transformer
export {
  type OpenAIMessage,
  type OpenAIContentPart,
  type OpenAIToolCall,
  type OpenAITool,
  type OpenAIRequest,
  type OpenAIResponse,
  type OpenAIStreamChunk,
  transformMessages,
  transformTools,
  transformResponse,
  transformStreamChunk,
  StreamAccumulator,
} from './OpenAITransformer';

// Error Mapper
export {
  type OpenAIError,
  type OpenAIErrorType,
  type MappedError,
  mapOpenAIError,
  isRetryableError,
  isAuthenticationError,
  isRateLimitError,
  isServerError,
  formatErrorMessage,
  shouldRetry,
  calculateBackoff,
  getRetryDelay,
} from './OpenAIErrorMapper';

// Stream Parser
export {
  parseSSEStream,
  parseSSEStreamNode,
  parseSSEString,
  parseStreamingResponse,
  isValidStreamChunk,
  collectStreamChunks,
  extractTextFromChunks,
  SSEParseError,
} from './OpenAIStreamParser';
