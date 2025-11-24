/**
 * OpenAI Provider Implementation
 *
 * Implements the LLM provider interface for OpenAI's GPT models.
 * Supports both synchronous and streaming completions with proper error handling,
 * retry logic, and request/response transformation.
 */

import type {
  Message,
  StreamChunk,
  Usage,
  FinishReason,
  ProviderCapabilities,
  ProviderMetadata,
} from '@llm-dev-ops/connector-hub-core';

import {
  OpenAIConfig,
  validateOpenAIConfig,
  mergeWithDefaults,
} from './OpenAIConfig';

import {
  transformMessages,
  transformResponse,
  transformStreamChunk,
  transformTools,
  StreamAccumulator,
  OpenAIRequest,
  OpenAIResponse,
} from './OpenAITransformer';

import { parseStreamingResponse } from './OpenAIStreamParser';

import {
  mapOpenAIError,
  shouldRetry,
  getRetryDelay,
  formatErrorMessage,
} from './OpenAIErrorMapper';

/**
 * Request structure for complete() method
 */
export interface CompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  stop?: string[];
  stream?: boolean;
  user?: string;
  functions?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
}

/**
 * Response structure from complete() method
 */
export interface CompletionResponse {
  message: Message;
  finish_reason: FinishReason;
  usage: Usage;
  metadata: ProviderMetadata;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  latency?: number;
  error?: string;
}

/**
 * OpenAI Provider class
 *
 * Implements the unified provider interface for OpenAI's GPT models.
 */
export class OpenAIProvider {
  private readonly config: ReturnType<typeof mergeWithDefaults>;
  private initialized: boolean = false;

  /**
   * Provider name identifier
   */
  public readonly name = 'openai';

  /**
   * Provider version
   */
  public readonly version = '1.0.0';

  /**
   * Provider capabilities
   */
  public readonly capabilities: ProviderCapabilities = {
    streaming: true,
    function_calling: true,
    vision: true,
    json_mode: true,
    supports_system_message: true,
  };

  /**
   * Creates a new OpenAI provider instance
   *
   * @param config - Provider configuration
   * @throws {OpenAIConfigError} If configuration is invalid
   */
  constructor(config: OpenAIConfig) {
    validateOpenAIConfig(config);
    this.config = mergeWithDefaults(config);
  }

  /**
   * Initializes the provider
   *
   * Sets up any necessary connections or resources.
   * For OpenAI, this is a no-op but included for interface compatibility.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Perform initial health check
    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new Error(`Failed to initialize OpenAI provider: ${health.error}`);
    }

    this.initialized = true;
  }

  /**
   * Shuts down the provider
   *
   * Cleans up any resources. For OpenAI, this is a no-op.
   */
  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  /**
   * Performs a synchronous completion request
   *
   * @param request - Completion request
   * @returns Completion response
   * @throws Error if request fails
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Transform request to OpenAI format
    const openaiRequest = this.buildOpenAIRequest(request, false);

    // Execute request with retries
    const response = await this.executeWithRetry(
      async () => await this.makeRequest<OpenAIResponse>(openaiRequest)
    );

    // Transform response to unified format
    const transformed = transformResponse(response);

    return {
      message: {
        role: transformed.role,
        content: transformed.content,
        tool_calls: transformed.tool_calls,
        function_call: transformed.function_call,
      },
      finish_reason: transformed.finish_reason,
      usage: transformed.usage,
      metadata: {
        provider: this.name,
        model: response.model,
        raw_response: response,
      },
    };
  }

  /**
   * Performs a streaming completion request
   *
   * @param request - Completion request
   * @returns Async iterable of stream chunks
   */
  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    // Transform request to OpenAI format
    const openaiRequest = this.buildOpenAIRequest(request, true);

    // Execute streaming request
    const response = await this.makeStreamingRequest(openaiRequest);

    // Parse and transform streaming events
    const accumulator = new StreamAccumulator();

    for await (const chunk of parseStreamingResponse(response)) {
      const streamChunk = transformStreamChunk(chunk, accumulator);
      if (streamChunk) {
        yield streamChunk;
      }
    }
  }

  /**
   * Performs a health check
   *
   * Verifies that the provider is accessible and configured correctly.
   *
   * @returns Health check result
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Make a minimal request to verify connectivity
      const request: OpenAIRequest = {
        model: 'gpt-3.5-turbo', // Use fastest model
        messages: [
          {
            role: 'user',
            content: 'Hi',
          },
        ],
        max_tokens: 1,
      };

      await this.makeRequest<OpenAIResponse>(request);

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      // Check if error is already mapped
      const isMappedError = typeof error === 'object' && error !== null &&
        'type' in error && 'message' in error && 'statusCode' in error && 'isRetryable' in error;

      const mapped = isMappedError ? error as import('./OpenAIErrorMapper').MappedError : mapOpenAIError(error);

      return {
        healthy: false,
        latency,
        error: formatErrorMessage(mapped),
      };
    }
  }

  /**
   * Validates a completion request
   *
   * @param request - Request to validate
   * @throws Error if request is invalid
   */
  validateRequest(request: CompletionRequest): void {
    if (!request.model) {
      throw new Error('Model is required');
    }

    if (!request.messages || request.messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    if (request.temperature !== undefined) {
      if (request.temperature < 0 || request.temperature > 2) {
        throw new Error('Temperature must be between 0 and 2');
      }
    }

    if (request.max_tokens !== undefined) {
      if (request.max_tokens <= 0) {
        throw new Error('Max tokens must be positive');
      }
    }

    if (request.top_p !== undefined) {
      if (request.top_p < 0 || request.top_p > 1) {
        throw new Error('top_p must be between 0 and 1');
      }
    }
  }

  /**
   * Builds OpenAI API request from unified request
   */
  private buildOpenAIRequest(request: CompletionRequest, stream: boolean): OpenAIRequest {
    this.validateRequest(request);

    const openaiMessages = transformMessages(request.messages);

    const openaiRequest: OpenAIRequest = {
      model: request.model,
      messages: openaiMessages,
      stream,
    };

    // Add optional parameters
    if (request.temperature !== undefined) {
      openaiRequest.temperature = request.temperature;
    }

    if (request.max_tokens !== undefined) {
      openaiRequest.max_tokens = request.max_tokens;
    } else if (this.config.defaultMaxTokens) {
      openaiRequest.max_tokens = this.config.defaultMaxTokens;
    }

    if (request.top_p !== undefined) {
      openaiRequest.top_p = request.top_p;
    }

    if (request.stop && request.stop.length > 0) {
      openaiRequest.stop = request.stop.length === 1 ? request.stop[0] : request.stop;
    }

    if (request.user) {
      openaiRequest.user = request.user;
    }

    // Add functions/tools if present
    if (request.functions && request.functions.length > 0) {
      openaiRequest.tools = transformTools(request.functions);
    }

    return openaiRequest;
  }

  /**
   * Makes a non-streaming request to OpenAI API
   */
  private async makeRequest<T>(request: OpenAIRequest): Promise<T> {
    const url = `${this.config.baseUrl}/v1/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };

    // Add organization ID if configured
    if (this.config.organizationId) {
      headers['OpenAI-Organization'] = this.config.organizationId;
    }

    // Add additional headers if configured
    if (this.config.additionalHeaders) {
      Object.assign(headers, this.config.additionalHeaders);
    }

    if (this.config.debug) {
      console.log('[OpenAI] Request:', JSON.stringify(request, null, 2));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw mapOpenAIError(errorData, response.status);
      }

      const data = await response.json();

      if (this.config.debug) {
        console.log('[OpenAI] Response:', JSON.stringify(data, null, 2));
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw {
          type: 'timeout',
          message: `Request timed out after ${this.config.timeout}ms`,
          statusCode: 408,
          isRetryable: true,
        };
      }

      // Re-throw if already mapped
      if (typeof error === 'object' && error !== null && 'type' in error) {
        throw error;
      }

      throw mapOpenAIError(error);
    }
  }

  /**
   * Makes a streaming request to OpenAI API
   */
  private async makeStreamingRequest(request: OpenAIRequest): Promise<Response> {
    const url = `${this.config.baseUrl}/v1/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };

    // Add organization ID if configured
    if (this.config.organizationId) {
      headers['OpenAI-Organization'] = this.config.organizationId;
    }

    // Add additional headers if configured
    if (this.config.additionalHeaders) {
      Object.assign(headers, this.config.additionalHeaders);
    }

    if (this.config.debug) {
      console.log('[OpenAI] Streaming Request:', JSON.stringify(request, null, 2));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const mapped = mapOpenAIError(errorData, response.status);
        const errorMessage = formatErrorMessage(mapped);
        const err = new Error(errorMessage);
        // Preserve error type information
        (err as any).type = mapped.type;
        (err as any).statusCode = mapped.statusCode;
        (err as any).isRetryable = mapped.isRetryable;
        throw err;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.config.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Executes a function with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if error is already mapped
        const isMappedError = typeof error === 'object' && error !== null &&
          'type' in error && 'message' in error && 'statusCode' in error && 'isRetryable' in error;

        const mapped = isMappedError ? error as import('./OpenAIErrorMapper').MappedError : mapOpenAIError(error);

        // Don't retry if not retryable or max attempts reached
        if (!shouldRetry(mapped, attempt, this.config.maxRetries)) {
          const errorMessage = formatErrorMessage(mapped);
          const err = new Error(errorMessage);
          // Preserve error type information
          (err as any).type = mapped.type;
          (err as any).statusCode = mapped.statusCode;
          (err as any).isRetryable = mapped.isRetryable;
          throw err;
        }

        // Calculate delay
        const delay = getRetryDelay(mapped, attempt);

        if (this.config.debug) {
          console.log(
            `[OpenAI] Retry ${attempt + 1}/${this.config.maxRetries} after ${delay}ms: ${mapped.message}`
          );
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
  }

  /**
   * Configures the provider (updates configuration)
   *
   * @param config - New configuration (partial)
   */
  configure(config: Partial<OpenAIConfig>): void {
    const newConfig = { ...this.config, ...config };
    validateOpenAIConfig(newConfig);
    Object.assign(this.config, mergeWithDefaults(newConfig));
  }

  /**
   * Gets provider metadata
   */
  getMetadata(): ProviderMetadata {
    return {
      provider: this.name,
      model: '', // Will be set per-request
      capabilities: this.capabilities,
      version: this.version,
    };
  }
}

/**
 * Factory function to create OpenAI provider
 *
 * @param config - Provider configuration
 * @returns Configured OpenAI provider instance
 */
export function createOpenAIProvider(config: OpenAIConfig): OpenAIProvider {
  return new OpenAIProvider(config);
}

/**
 * Helper to create provider from environment variables
 *
 * Expects:
 * - OPENAI_API_KEY: API key
 * - OPENAI_ORGANIZATION_ID (optional): Organization ID
 * - OPENAI_BASE_URL (optional): Custom base URL
 * - OPENAI_TIMEOUT (optional): Request timeout in ms
 *
 * @returns Configured OpenAI provider instance
 */
export function createOpenAIProviderFromEnv(): OpenAIProvider {
  const apiKey = process.env['OPENAI_API_KEY'];

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const config: OpenAIConfig = {
    apiKey,
    organizationId: process.env['OPENAI_ORGANIZATION_ID'],
    baseUrl: process.env['OPENAI_BASE_URL'],
    timeout: process.env['OPENAI_TIMEOUT'] ? parseInt(process.env['OPENAI_TIMEOUT'], 10) : undefined,
    maxRetries: process.env['OPENAI_MAX_RETRIES']
      ? parseInt(process.env['OPENAI_MAX_RETRIES'], 10)
      : undefined,
    debug: process.env['OPENAI_DEBUG'] === 'true',
  };

  return new OpenAIProvider(config);
}
