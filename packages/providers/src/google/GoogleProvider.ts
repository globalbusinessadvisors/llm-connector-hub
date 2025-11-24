/**
 * Google AI (Gemini) Provider Implementation
 *
 * Implements the LLM provider interface for Google's Gemini models.
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

// Local type declaration for FunctionDefinition
type FunctionDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

import {
  GoogleConfig,
  validateGoogleConfig,
  mergeWithDefaults,
} from './GoogleConfig';

import {
  transformMessages,
  transformResponse,
  transformStreamChunk,
  transformTools,
  buildGenerationConfig,
  StreamAccumulator,
  GoogleRequest,
  GoogleResponse,
} from './GoogleTransformer';

import { parseGoogleReadableStream } from './GoogleStreamParser';

import {
  parseErrorFromResponse,
  createNetworkError,
  createTimeoutError,
  createSafetyError,
  shouldRetry,
  calculateRetryDelay,
  GoogleProviderError,
} from './GoogleErrorMapper';

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
  functions?: FunctionDefinition[];
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
 * Google AI Provider class
 *
 * Implements the unified provider interface for Google's Gemini models.
 */
export class GoogleProvider {
  private readonly config: ReturnType<typeof mergeWithDefaults>;
  private initialized: boolean = false;

  /**
   * Provider name identifier
   */
  public readonly name = 'google';

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
   * Creates a new Google AI provider instance
   *
   * @param config - Provider configuration
   * @throws {GoogleConfigError} If configuration is invalid
   */
  constructor(config: GoogleConfig) {
    validateGoogleConfig(config);
    this.config = mergeWithDefaults(config);
  }

  /**
   * Initializes the provider
   *
   * Sets up any necessary connections or resources.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Perform initial health check
    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new Error(`Failed to initialize Google AI provider: ${health.error}`);
    }

    this.initialized = true;
  }

  /**
   * Shuts down the provider
   *
   * Cleans up any resources.
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
    // Transform request to Google AI format
    const googleRequest = this.buildGoogleRequest(request, false);

    // Execute request with retries
    const response = await this.executeWithRetry(
      async () => await this.makeRequest<GoogleResponse>(request.model, googleRequest)
    );

    // Check for safety blocking
    if (response.promptFeedback?.blockReason === 'SAFETY') {
      throw createSafetyError(response.promptFeedback.safetyRatings);
    }

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
        model: request.model,
        raw_response: response,
        ...transformed.metadata,
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
    // Transform request to Google AI format
    const googleRequest = this.buildGoogleRequest(request, true);

    // Execute streaming request
    const response = await this.makeStreamingRequest(request.model, googleRequest);

    // Parse and transform streaming events
    const accumulator = new StreamAccumulator();

    for await (const chunk of parseGoogleReadableStream(response.body!)) {
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
      // Use gemini-1.5-flash for faster health checks
      const testModel = 'gemini-1.5-flash';

      const request: GoogleRequest = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hi' }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1,
        },
      };

      await this.makeRequest<GoogleResponse>(testModel, request);

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      return {
        healthy: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
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

    if (request.top_k !== undefined) {
      if (request.top_k < 0) {
        throw new Error('top_k must be non-negative');
      }
    }
  }

  /**
   * Builds Google AI API request from unified request
   */
  private buildGoogleRequest(request: CompletionRequest, _stream: boolean): GoogleRequest {
    this.validateRequest(request);

    const [systemParts, contents] = transformMessages(request.messages);

    const googleRequest: GoogleRequest = {
      contents,
      generationConfig: buildGenerationConfig({
        temperature: request.temperature,
        top_p: request.top_p,
        top_k: request.top_k,
        max_tokens: request.max_tokens,
        stop: request.stop,
        defaultMaxTokens: this.config.defaultMaxTokens,
      }),
      safetySettings: this.config.defaultSafetySettings,
    };

    // Add system instruction if present
    if (systemParts && systemParts.length > 0) {
      googleRequest.systemInstruction = {
        parts: systemParts.filter((part): part is { text: string } => 'text' in part),
      };
    }

    // Add tools/functions if present
    if (request.functions && request.functions.length > 0) {
      googleRequest.tools = transformTools(request.functions);
    }

    return googleRequest;
  }

  /**
   * Makes an HTTP request to Google AI API
   */
  private async makeRequest<T>(model: string, data: GoogleRequest): Promise<T> {
    const url = this.buildApiUrl(model, false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await parseErrorFromResponse(response);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof GoogleProviderError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw createTimeoutError(this.config.timeout);
        }
        throw createNetworkError(error);
      }

      throw error;
    }
  }

  /**
   * Makes a streaming HTTP request to Google AI API
   */
  private async makeStreamingRequest(model: string, data: GoogleRequest): Promise<Response> {
    const url = this.buildApiUrl(model, true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await parseErrorFromResponse(response);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof GoogleProviderError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw createTimeoutError(this.config.timeout);
        }
        throw createNetworkError(error);
      }

      throw error;
    }
  }

  /**
   * Builds the API URL for a request
   */
  private buildApiUrl(model: string, stream: boolean): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    const endpoint = stream ? 'streamGenerateContent' : 'generateContent';
    return `${baseUrl}/models/${model}:${endpoint}?key=${this.config.apiKey}`;
  }

  /**
   * Builds HTTP headers for requests
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add additional headers if configured
    if (this.config.additionalHeaders) {
      Object.assign(headers, this.config.additionalHeaders);
    }

    return headers;
  }

  /**
   * Executes a function with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on last attempt
        if (attempt === this.config.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (error instanceof GoogleProviderError) {
          if (!shouldRetry(error, attempt, this.config.maxRetries)) {
            throw error;
          }

          // Calculate retry delay
          const delay = calculateRetryDelay(attempt);

          if (this.config.debug) {
            console.log(
              `Google AI request failed (attempt ${attempt + 1}/${this.config.maxRetries + 1}), ` +
              `retrying in ${delay}ms...`
            );
          }

          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // Non-GoogleProviderError, don't retry
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Gets the list of available models
   *
   * @returns Array of model IDs
   */
  async listModels(): Promise<string[]> {
    const url = `${this.config.baseUrl}/models?key=${this.config.apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw await parseErrorFromResponse(response);
      }

      const data = (await response.json()) as {
        models: Array<{ name: string; displayName: string }>;
      };

      return data.models.map((m) => m.name.replace('models/', ''));
    } catch (error) {
      if (error instanceof GoogleProviderError) {
        throw error;
      }

      if (error instanceof Error) {
        throw createNetworkError(error);
      }

      throw error;
    }
  }

  /**
   * Gets detailed information about a specific model
   *
   * @param model - Model ID
   * @returns Model information
   */
  async getModelInfo(model: string): Promise<unknown> {
    const url = `${this.config.baseUrl}/models/${model}?key=${this.config.apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw await parseErrorFromResponse(response);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof GoogleProviderError) {
        throw error;
      }

      if (error instanceof Error) {
        throw createNetworkError(error);
      }

      throw error;
    }
  }
}

/**
 * Factory function to create a Google AI provider
 *
 * @param config - Provider configuration
 * @returns Configured Google AI provider instance
 */
export function createGoogleProvider(config: GoogleConfig): GoogleProvider {
  return new GoogleProvider(config);
}

/**
 * Helper to create provider from environment variables
 *
 * Expects:
 * - GOOGLE_API_KEY: API key
 * - GOOGLE_BASE_URL (optional): Custom base URL
 * - GOOGLE_TIMEOUT (optional): Request timeout in ms
 *
 * @returns Configured Google AI provider instance
 */
export function createGoogleProviderFromEnv(): GoogleProvider {
  const apiKey = process.env['GOOGLE_API_KEY'];

  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is required');
  }

  const config: GoogleConfig = {
    apiKey,
    baseUrl: process.env['GOOGLE_BASE_URL'],
    timeout: process.env['GOOGLE_TIMEOUT'] ? parseInt(process.env['GOOGLE_TIMEOUT'], 10) : undefined,
    maxRetries: process.env['GOOGLE_MAX_RETRIES']
      ? parseInt(process.env['GOOGLE_MAX_RETRIES'], 10)
      : undefined,
    debug: process.env['GOOGLE_DEBUG'] === 'true',
  };

  return new GoogleProvider(config);
}
