/**
 * Anthropic (Claude) Provider Implementation
 *
 * Implements the LLM provider interface for Anthropic's Claude models.
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
} from '@llm-connector-hub/core';

import {
  AnthropicConfig,
  validateAnthropicConfig,
  mergeWithDefaults,
} from './AnthropicConfig';

import {
  transformMessages,
  transformResponse,
  transformStreamEvent,
  StreamAccumulator,
  ensureMaxTokens,
  AnthropicRequest,
  AnthropicResponse,
} from './AnthropicTransformer';

import { parseStreamingResponse } from './AnthropicStreamParser';

import {
  mapAnthropicError,
  shouldRetry,
  getRetryDelay,
  formatErrorMessage,
} from './AnthropicErrorMapper';

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
 * Anthropic Provider class
 *
 * Implements the unified provider interface for Anthropic's Claude models.
 */
export class AnthropicProvider {
  private readonly config: ReturnType<typeof mergeWithDefaults>;
  private initialized: boolean = false;

  /**
   * Provider name identifier
   */
  public readonly name = 'anthropic';

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
    json_mode: false,
    supports_system_message: true,
  };

  /**
   * Creates a new Anthropic provider instance
   *
   * @param config - Provider configuration
   * @throws {AnthropicConfigError} If configuration is invalid
   */
  constructor(config: AnthropicConfig) {
    validateAnthropicConfig(config);
    this.config = mergeWithDefaults(config);
  }

  /**
   * Initializes the provider
   *
   * Sets up any necessary connections or resources.
   * For Anthropic, this is a no-op but included for interface compatibility.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Perform initial health check
    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new Error(`Failed to initialize Anthropic provider: ${health.error}`);
    }

    this.initialized = true;
  }

  /**
   * Shuts down the provider
   *
   * Cleans up any resources. For Anthropic, this is a no-op.
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
    // Transform request to Anthropic format
    const anthropicRequest = this.buildAnthropicRequest(request, false);

    // Execute request with retries
    const response = await this.executeWithRetry(
      async () => await this.makeRequest<AnthropicResponse>(anthropicRequest)
    );

    // Transform response to unified format
    const transformed = transformResponse(response);

    return {
      message: {
        role: transformed.role,
        content: transformed.content,
        tool_calls: transformed.tool_calls,
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
    // Transform request to Anthropic format
    const anthropicRequest = this.buildAnthropicRequest(request, true);

    // Execute streaming request
    const response = await this.makeStreamingRequest(anthropicRequest);

    // Parse and transform streaming events
    const accumulator = new StreamAccumulator();

    for await (const event of parseStreamingResponse(response)) {
      const chunk = transformStreamEvent(event, accumulator);
      if (chunk) {
        yield chunk;
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
      const request: AnthropicRequest = {
        model: 'claude-3-haiku-20240307', // Use fastest model
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hi' }],
          },
        ],
        max_tokens: 1,
      };

      await this.makeRequest<AnthropicResponse>(request);

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      // Check if error is already mapped (has type, message, statusCode, isRetryable properties)
      const isMappedError = typeof error === 'object' && error !== null &&
        'type' in error && 'message' in error && 'statusCode' in error && 'isRetryable' in error;

      const mapped = isMappedError ? error as import('./AnthropicErrorMapper').MappedError : mapAnthropicError(error);

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
  }

  /**
   * Builds Anthropic API request from unified request
   */
  private buildAnthropicRequest(request: CompletionRequest, stream: boolean): AnthropicRequest {
    this.validateRequest(request);

    const [systemMessage, anthropicMessages] = transformMessages(request.messages);

    const anthropicRequest: AnthropicRequest = {
      model: request.model,
      messages: anthropicMessages,
      max_tokens: ensureMaxTokens(request.max_tokens, this.config.defaultMaxTokens),
      stream,
    };

    // Add system message if present
    if (systemMessage) {
      anthropicRequest.system = systemMessage;
    }

    // Add optional parameters
    if (request.temperature !== undefined) {
      anthropicRequest.temperature = request.temperature;
    }

    if (request.top_p !== undefined) {
      anthropicRequest.top_p = request.top_p;
    }

    if (request.top_k !== undefined) {
      anthropicRequest.top_k = request.top_k;
    }

    if (request.stop && request.stop.length > 0) {
      anthropicRequest.stop_sequences = request.stop;
    }

    if (request.user) {
      anthropicRequest.metadata = {
        user_id: request.user,
      };
    }

    return anthropicRequest;
  }

  /**
   * Makes a non-streaming request to Anthropic API
   */
  private async makeRequest<T>(request: AnthropicRequest): Promise<T> {
    const url = `${this.config.baseUrl}/v1/messages`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': this.config.apiVersion,
    };

    // Add additional headers if configured
    if (this.config.additionalHeaders) {
      Object.assign(headers, this.config.additionalHeaders);
    }

    if (this.config.debug) {
      console.log('[Anthropic] Request:', JSON.stringify(request, null, 2));
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
        throw mapAnthropicError(errorData, response.status);
      }

      const data = await response.json();

      if (this.config.debug) {
        console.log('[Anthropic] Response:', JSON.stringify(data, null, 2));
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

      throw mapAnthropicError(error);
    }
  }

  /**
   * Makes a streaming request to Anthropic API
   */
  private async makeStreamingRequest(request: AnthropicRequest): Promise<Response> {
    const url = `${this.config.baseUrl}/v1/messages`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': this.config.apiVersion,
    };

    // Add additional headers if configured
    if (this.config.additionalHeaders) {
      Object.assign(headers, this.config.additionalHeaders);
    }

    if (this.config.debug) {
      console.log('[Anthropic] Streaming Request:', JSON.stringify(request, null, 2));
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
        const mapped = mapAnthropicError(errorData, response.status);
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

        // Check if error is already mapped (has type, message, statusCode, isRetryable properties)
        const isMappedError = typeof error === 'object' && error !== null &&
          'type' in error && 'message' in error && 'statusCode' in error && 'isRetryable' in error;

        const mapped = isMappedError ? error as import('./AnthropicErrorMapper').MappedError : mapAnthropicError(error);

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
            `[Anthropic] Retry ${attempt + 1}/${this.config.maxRetries} after ${delay}ms: ${mapped.message}`
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
  configure(config: Partial<AnthropicConfig>): void {
    const newConfig = { ...this.config, ...config };
    validateAnthropicConfig(newConfig);
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
 * Factory function to create Anthropic provider
 *
 * @param config - Provider configuration
 * @returns Configured Anthropic provider instance
 */
export function createAnthropicProvider(config: AnthropicConfig): AnthropicProvider {
  return new AnthropicProvider(config);
}
