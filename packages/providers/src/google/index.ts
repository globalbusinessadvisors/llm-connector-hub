/**
 * Google AI (Gemini) Provider
 *
 * Unified export for all Google AI provider components.
 */

// Main provider class
export {
  GoogleProvider,
  createGoogleProvider,
  createGoogleProviderFromEnv,
  type CompletionRequest,
  type CompletionResponse,
  type HealthCheckResult,
} from './GoogleProvider';

// Configuration
export {
  type GoogleConfig,
  type GoogleSafetySetting,
  type GoogleModel,
  type GoogleModelInfo,
  GoogleConfigError,
  validateGoogleConfig,
  mergeWithDefaults,
  getModelInfo,
  supportsVision,
  supportsStreaming,
  supportsTools,
  getMaxTokens,
  getContextWindow,
  GOOGLE_MODELS,
  GOOGLE_MODEL_INFO,
  DEFAULT_GOOGLE_CONFIG,
  DEFAULT_SAFETY_SETTINGS,
} from './GoogleConfig';

// Transformer
export {
  type GoogleContentPart,
  type GoogleTextPart,
  type GoogleInlineDataPart,
  type GoogleFunctionCallPart,
  type GoogleFunctionResponsePart,
  type GoogleContent,
  type GoogleGenerationConfig,
  type GoogleFunctionDeclaration,
  type GoogleTool,
  type GoogleRequest,
  type GoogleCandidate,
  type GoogleResponse,
  type GoogleStreamChunk,
  transformMessages,
  transformTools,
  transformResponse,
  transformStreamChunk,
  buildGenerationConfig,
  ensureMaxTokens,
  StreamAccumulator,
} from './GoogleTransformer';

// Stream parser
export {
  type ParsedSSEEvent,
  GoogleStreamParser,
  parseGoogleStream,
  parseGoogleReadableStream,
  collectStreamChunks,
  isValidGoogleStreamChunk,
  GoogleStreamParseError,
  parseSSELine,
} from './GoogleStreamParser';

// Error mapper
export {
  type GoogleErrorResponse,
  GoogleProviderError,
  mapHttpStatusToErrorType,
  isRetryableStatusCode,
  mapGoogleError,
  parseErrorFromResponse,
  createNetworkError,
  createTimeoutError,
  createConfigError,
  createStreamError,
  createSafetyError,
  shouldRetry,
  calculateRetryDelay,
  extractRetryAfter,
} from './GoogleErrorMapper';
