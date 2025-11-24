/**
 * Azure OpenAI Provider Implementation
 *
 * Implements the LLM provider interface for Azure OpenAI models.
 * Supports both synchronous and streaming completions with proper error handling,
 * retry logic, and request/response transformation.
 *
 * Key differences from standard OpenAI:
 * - Uses deployment-based URLs
 * - Authentication via api-key header
 * - Different API versioning
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
  AzureConfig,
  validateAzureConfig,
  mergeWithDefaults,
} from './AzureConfig';

import {
  transformMessages,
  transformResponse,
  transformStreamChunk,
  transformTools,
  ensureMaxTokens,
  StreamAccumulator,
  AzureRequest,
  AzureResponse,
} from './AzureTransformer';

import { parseStreamingResponse } from './AzureStreamParser';

import {
  mapAzureError,
  shouldRetry,
  getRetryDelay,
  formatErrorMessage,
} from './AzureErrorMapper';

// Re-declare function definition type
type FunctionDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

/**
 * Request structure for complete() method
 */
export interface CompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
  user?: string;
  functions?: FunctionDefinition[];
  presence_penalty?: number;
  frequency_penalty?: number;
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
 * Azure OpenAI Provider class
 *
 * Implements the unified provider interface for Azure OpenAI models.
 */
export class AzureProvider {
  private readonly config: ReturnType<typeof mergeWithDefaults>;
  private initialized: boolean = false;

  /**
   * Provider name identifier
   */
  public readonly name = 'azure';

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
   * Creates a new Azure OpenAI provider instance
   *
   * @param config - Provider configuration
   * @throws {AzureConfigError} If configuration is invalid
   */
  constructor(config: AzureConfig) {
    validateAzureConfig(config);
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
      throw new Error(`Failed to initialize Azure OpenAI provider: ${health.error}`);
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
    // Transform request to Azure OpenAI format
    const azureRequest = this.buildAzureRequest(request, false);

    // Execute request with retries
    const response = await this.executeWithRetry(
      async () => await this.makeRequest<AzureResponse>(azureRequest)
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
    // Transform request to Azure OpenAI format
    const azureRequest = this.buildAzureRequest(request, true);

    // Execute streaming request
    const response = await this.makeStreamingRequest(azureRequest);

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
      const request: AzureRequest = {
        messages: [
          {
            role: 'user',
            content: 'Hi',
          },
        ],
        max_tokens: 1,
      };

      await this.makeRequest<AzureResponse>(request);

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      // Check if error is already mapped
      const isMappedError =
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        'message' in error &&
        'statusCode' in error &&
        'isRetryable' in error;

      const mapped = isMappedError
        ? (error as import('./AzureErrorMapper').MappedError)
        : mapAzureError(error);

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
   * Builds Azure OpenAI API request from unified request
   */
  private buildAzureRequest(
    request: CompletionRequest,
    stream: boolean
  ): AzureRequest {
    this.validateRequest(request);

    const azureMessages = transformMessages(request.messages);

    const azureRequest: AzureRequest = {
      messages: azureMessages,
      max_tokens: ensureMaxTokens(request.max_tokens, this.config.defaultMaxTokens),
      stream,
    };

    // Add optional parameters
    if (request.temperature !== undefined) {
      azureRequest.temperature = request.temperature;
    }

    if (request.top_p !== undefined) {
      azureRequest.top_p = request.top_p;
    }

    if (request.stop) {
      azureRequest.stop = request.stop;
    }

    if (request.user) {
      azureRequest.user = request.user;
    }

    if (request.presence_penalty !== undefined) {
      azureRequest.presence_penalty = request.presence_penalty;
    }

    if (request.frequency_penalty !== undefined) {
      azureRequest.frequency_penalty = request.frequency_penalty;
    }

    // Add tools/functions if present
    if (request.functions && request.functions.length > 0) {
      azureRequest.tools = transformTools(request.functions);
      azureRequest.tool_choice = 'auto';
    }

    return azureRequest;
  }

  /**
   * Builds the Azure OpenAI API URL
   */
  private buildApiUrl(): string {
    const endpoint = this.config.endpoint?.replace(/\/$/, '');
    const deployment = this.config.deploymentName;
    const apiVersion = this.config.apiVersion;

    return `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  }

  /**
   * Makes a non-streaming request to Azure OpenAI API
   */
  private async makeRequest<T>(request: AzureRequest): Promise<T> {
    const url = this.buildApiUrl();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api-key': this.config.apiKey,
    };

    // Add additional headers if configured
    if (this.config.additionalHeaders) {
      Object.assign(headers, this.config.additionalHeaders);
    }

    if (this.config.debug) {
      console.log('[Azure OpenAI] Request URL:', url);
      console.log('[Azure OpenAI] Request:', JSON.stringify(request, null, 2));
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
        throw mapAzureError(errorData, response.status);
      }

      const data = await response.json();

      if (this.config.debug) {
        console.log('[Azure OpenAI] Response:', JSON.stringify(data, null, 2));
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

      throw mapAzureError(error);
    }
  }

  /**
   * Makes a streaming request to Azure OpenAI API
   */
  private async makeStreamingRequest(request: AzureRequest): Promise<Response> {
    const url = this.buildApiUrl();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api-key': this.config.apiKey,
    };

    // Add additional headers if configured
    if (this.config.additionalHeaders) {
      Object.assign(headers, this.config.additionalHeaders);
    }

    if (this.config.debug) {
      console.log('[Azure OpenAI] Streaming Request URL:', url);
      console.log('[Azure OpenAI] Streaming Request:', JSON.stringify(request, null, 2));
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
        const mapped = mapAzureError(errorData, response.status);
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
        const isMappedError =
          typeof error === 'object' &&
          error !== null &&
          'type' in error &&
          'message' in error &&
          'statusCode' in error &&
          'isRetryable' in error;

        const mapped = isMappedError
          ? (error as import('./AzureErrorMapper').MappedError)
          : mapAzureError(error);

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
            `[Azure OpenAI] Retry ${attempt + 1}/${this.config.maxRetries} after ${delay}ms: ${mapped.message}`
          );
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
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
  configure(config: Partial<AzureConfig>): void {
    const newConfig = { ...this.config, ...config };
    validateAzureConfig(newConfig);
    Object.assign(this.config, mergeWithDefaults(newConfig));
  }

  /**
   * Gets provider metadata
   */
  getMetadata(): ProviderMetadata {
    return {
      provider: this.name,
      model: this.config.deploymentName,
      capabilities: this.capabilities,
      version: this.version,
    };
  }

  /**
   * Gets the deployment name
   */
  getDeploymentName(): string {
    return this.config.deploymentName;
  }

  /**
   * Gets the endpoint URL
   */
  getEndpoint(): string | undefined {
    return this.config.endpoint;
  }
}

/**
 * Factory function to create Azure OpenAI provider
 *
 * @param config - Provider configuration
 * @returns Configured Azure OpenAI provider instance
 */
export function createAzureProvider(config: AzureConfig): AzureProvider {
  return new AzureProvider(config);
}

/**
 * Helper to create provider from environment variables
 *
 * Expects:
 * - AZURE_OPENAI_API_KEY: API key
 * - AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_RESOURCE_NAME: Endpoint configuration
 * - AZURE_OPENAI_DEPLOYMENT_NAME: Deployment name
 * - AZURE_OPENAI_API_VERSION (optional): API version
 * - AZURE_OPENAI_TIMEOUT (optional): Request timeout in ms
 *
 * @returns Configured Azure OpenAI provider instance
 */
export function createAzureProviderFromEnv(): AzureProvider {
  const apiKey = process.env['AZURE_OPENAI_API_KEY'];

  if (!apiKey) {
    throw new Error('AZURE_OPENAI_API_KEY environment variable is required');
  }

  const deploymentName = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'];

  if (!deploymentName) {
    throw new Error('AZURE_OPENAI_DEPLOYMENT_NAME environment variable is required');
  }

  const endpoint = process.env['AZURE_OPENAI_ENDPOINT'];
  const resourceName = process.env['AZURE_OPENAI_RESOURCE_NAME'];

  if (!endpoint && !resourceName) {
    throw new Error(
      'Either AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_RESOURCE_NAME environment variable is required'
    );
  }

  const config: AzureConfig = {
    apiKey,
    deploymentName,
    endpoint,
    resourceName,
    apiVersion: process.env['AZURE_OPENAI_API_VERSION'],
    timeout: process.env['AZURE_OPENAI_TIMEOUT']
      ? parseInt(process.env['AZURE_OPENAI_TIMEOUT'], 10)
      : undefined,
    maxRetries: process.env['AZURE_OPENAI_MAX_RETRIES']
      ? parseInt(process.env['AZURE_OPENAI_MAX_RETRIES'], 10)
      : undefined,
    debug: process.env['AZURE_OPENAI_DEBUG'] === 'true',
  };

  return new AzureProvider(config);
}
