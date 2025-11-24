/**
 * Azure OpenAI Provider
 *
 * Complete provider implementation for Azure OpenAI models.
 * Supports GPT-4, GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo, and future GPT-5 models.
 *
 * @example
 * ```typescript
 * import { createAzureProvider, AZURE_MODELS } from '@llm-dev-ops/connector-hub-providers/azure';
 *
 * const provider = createAzureProvider({
 *   apiKey: 'your-azure-api-key',
 *   resourceName: 'your-resource-name',
 *   deploymentName: 'gpt-4o-deployment',
 * });
 *
 * await provider.initialize();
 *
 * const response = await provider.complete({
 *   model: AZURE_MODELS.GPT_4O,
 *   messages: [
 *     { role: 'user', content: 'Hello, Azure OpenAI!' }
 *   ],
 * });
 * ```
 *
 * @example Using endpoint URL
 * ```typescript
 * const provider = createAzureProvider({
 *   apiKey: 'your-azure-api-key',
 *   endpoint: 'https://your-resource.openai.azure.com',
 *   deploymentName: 'gpt-4o-deployment',
 * });
 * ```
 *
 * @example Streaming
 * ```typescript
 * for await (const chunk of provider.stream({
 *   model: AZURE_MODELS.GPT_4O,
 *   messages: [
 *     { role: 'user', content: 'Tell me a story' }
 *   ],
 * })) {
 *   console.log(chunk.content);
 * }
 * ```
 *
 * @example With function calling
 * ```typescript
 * const response = await provider.complete({
 *   model: AZURE_MODELS.GPT_4O,
 *   messages: [
 *     { role: 'user', content: 'What is the weather in San Francisco?' }
 *   ],
 *   functions: [
 *     {
 *       name: 'get_weather',
 *       description: 'Get the current weather in a location',
 *       parameters: {
 *         type: 'object',
 *         properties: {
 *           location: { type: 'string' },
 *           unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
 *         },
 *         required: ['location'],
 *       },
 *     },
 *   ],
 * });
 * ```
 *
 * @example With vision (GPT-4o, GPT-4 Turbo)
 * ```typescript
 * const response = await provider.complete({
 *   model: AZURE_MODELS.GPT_4O,
 *   messages: [
 *     {
 *       role: 'user',
 *       content: [
 *         { type: 'text', text: 'What is in this image?' },
 *         { type: 'image_url', image_url: 'https://example.com/image.jpg' },
 *       ],
 *     },
 *   ],
 * });
 * ```
 */

// Provider
export {
  AzureProvider,
  createAzureProvider,
  createAzureProviderFromEnv,
} from './AzureProvider';

export type {
  CompletionRequest,
  CompletionResponse,
  HealthCheckResult,
} from './AzureProvider';

// Configuration
export type {
  AzureConfig,
  AzureModel,
  AzureModelInfo,
} from './AzureConfig';

export {
  AzureConfigError,
  AZURE_MODELS,
  AZURE_MODEL_INFO,
  DEFAULT_AZURE_CONFIG,
  validateAzureConfig,
  mergeWithDefaults,
  getModelInfo,
  supportsVision,
  supportsStreaming,
  supportsFunctionCalling,
  getMaxTokens,
} from './AzureConfig';

// Transformer
export type {
  AzureRequest,
  AzureResponse,
  AzureStreamChunk,
  AzureMessage,
  AzureContentPart,
  AzureTextPart,
  AzureImagePart,
  AzureToolCall,
  AzureFunctionDefinition,
  AzureTool,
} from './AzureTransformer';

export {
  transformMessages,
  transformResponse,
  transformStreamChunk,
  transformTools,
  ensureMaxTokens,
  StreamAccumulator,
} from './AzureTransformer';

// Error Mapper
export type {
  AzureError,
  AzureErrorCode,
  MappedError,
} from './AzureErrorMapper';

export {
  mapAzureError,
  isRetryableError,
  isAuthenticationError,
  isRateLimitError,
  isServerError,
  isDeploymentError,
  formatErrorMessage,
  shouldRetry,
  calculateBackoff,
  getRetryDelay,
} from './AzureErrorMapper';

// Stream Parser
export type { SSEEvent } from './AzureStreamParser';

export {
  parseSSEStream,
  parseSSEStreamNode,
  parseSSEString,
  parseStreamingResponse,
  isValidStreamChunk,
  SSEParseError,
  combineChunks,
  extractFinishReason,
} from './AzureStreamParser';
