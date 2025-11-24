/**
 * AWS Bedrock Provider Implementation
 *
 * Implements the LLM provider interface for AWS Bedrock models.
 * Supports multiple model providers (Anthropic Claude, Meta Llama, Mistral)
 * with streaming, function calling, and proper error handling.
 *
 * Note: This implementation uses direct HTTP calls to AWS Bedrock Runtime API.
 * In production, you should use @aws-sdk/client-bedrock-runtime for proper
 * AWS signature authentication and better error handling.
 */

import type {
  Message,
  StreamChunk,
  Usage,
  FinishReason,
  ProviderCapabilities,
  ProviderMetadata,
} from '@llm-dev-ops/connector-hub-core';

// Local type declaration for FunctionDefinition
type FunctionDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

import {
  BedrockConfig,
  validateBedrockConfig,
  mergeWithDefaults,
  getModelProvider,
  supportsFunctionCalling,
} from './BedrockConfig';

import {
  transformRequest,
  transformResponse,
  transformStreamChunk,
  ensureMaxTokens,
  BedrockRequest,
  BedrockResponse,
} from './BedrockTransformer';

import {
  parseBedrockStream,
  parseStreamChunk,
  StreamAccumulator,
} from './BedrockStreamParser';

import {
  mapBedrockError,
  shouldRetry,
  getRetryDelay,
  formatErrorMessage,
  MappedError,
} from './BedrockErrorMapper';

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
 * AWS Bedrock Provider class
 *
 * Implements the unified provider interface for AWS Bedrock models.
 * This is a simplified implementation that demonstrates the structure.
 * For production use, integrate @aws-sdk/client-bedrock-runtime.
 */
export class BedrockProvider {
  private readonly config: ReturnType<typeof mergeWithDefaults>;
  private initialized: boolean = false;

  /**
   * Provider name identifier
   */
  public readonly name = 'bedrock';

  /**
   * Provider version
   */
  public readonly version = '1.0.0';

  /**
   * Provider capabilities (will vary by model)
   */
  public readonly capabilities: ProviderCapabilities = {
    streaming: true,
    function_calling: true,
    vision: true,
    json_mode: false,
    supports_system_message: true,
  };

  /**
   * Creates a new AWS Bedrock provider instance
   *
   * @param config - Provider configuration
   * @throws {BedrockConfigError} If configuration is invalid
   */
  constructor(config: BedrockConfig) {
    validateBedrockConfig(config);
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
      throw new Error(`Failed to initialize AWS Bedrock provider: ${health.error}`);
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
    this.validateRequest(request);

    const provider = getModelProvider(request.model);
    if (!provider) {
      throw new Error(`Unknown model provider for: ${request.model}`);
    }

    // Transform request to Bedrock format
    const bedrockRequest = this.buildBedrockRequest(request, false);

    // Execute request with retries
    const response = await this.executeWithRetry(
      async () => await this.invokeModel<BedrockResponse>(request.model, bedrockRequest)
    );

    // Transform response to unified format
    const transformed = transformResponse(response, provider);

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
    this.validateRequest(request);

    const provider = getModelProvider(request.model);
    if (!provider) {
      throw new Error(`Unknown model provider for: ${request.model}`);
    }

    // Transform request to Bedrock format
    const bedrockRequest = this.buildBedrockRequest(request, true);

    // Execute streaming request
    const stream = await this.invokeModelWithResponseStream(request.model, bedrockRequest);

    // Parse and transform streaming events
    const accumulator = new StreamAccumulator();

    for await (const event of parseBedrockStream(stream)) {
      if (event.type === 'chunk') {
        const parsed = parseStreamChunk(event.bytes, provider);
        if (parsed) {
          accumulator.addChunk(parsed);

          if (parsed.content) {
            yield {
              content: parsed.content,
            };
          }

          if (parsed.isComplete && parsed.stopReason) {
            yield {
              finish_reason: transformStreamChunk('', parsed.stopReason, provider).finish_reason,
            };
          }
        }
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
      // Use a fast, small model for health check
      const testModel = 'anthropic.claude-3-haiku-20240307-v1:0';
      const provider = getModelProvider(testModel);

      if (!provider) {
        throw new Error('Test model provider not found');
      }

      const request = transformRequest(
        [{ role: 'user', content: 'Hi' }],
        provider,
        1,
        {}
      );

      await this.invokeModel<BedrockResponse>(testModel, request);

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      const mapped = this.isMappedError(error) ? error as MappedError : mapBedrockError(error);

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

    // Check if function calling is supported
    if (request.functions && request.functions.length > 0) {
      if (!supportsFunctionCalling(request.model)) {
        throw new Error(`Model ${request.model} does not support function calling`);
      }
    }
  }

  /**
   * Builds Bedrock API request from unified request
   */
  private buildBedrockRequest(request: CompletionRequest, _stream: boolean): BedrockRequest {
    const provider = getModelProvider(request.model);
    if (!provider) {
      throw new Error(`Unknown model provider for: ${request.model}`);
    }

    return transformRequest(
      request.messages,
      provider,
      ensureMaxTokens(request.max_tokens, this.config.defaultMaxTokens),
      {
        temperature: request.temperature,
        top_p: request.top_p,
        top_k: request.top_k,
        stop: request.stop,
        functions: request.functions,
      }
    );
  }

  /**
   * Invokes a Bedrock model (non-streaming)
   *
   * This is a placeholder implementation. In production, use:
   * @aws-sdk/client-bedrock-runtime with InvokeModelCommand
   *
   * @param modelId - Model ARN
   * @param body - Request body
   * @returns Response
   */
  private async invokeModel<T>(modelId: string, body: BedrockRequest): Promise<T> {
    // This is a placeholder. Real implementation would:
    // 1. Use AWS SDK v3: @aws-sdk/client-bedrock-runtime
    // 2. Create BedrockRuntimeClient with credentials
    // 3. Use InvokeModelCommand
    // 4. Handle AWS Signature V4 authentication

    if (this.config.debug) {
      console.log('[Bedrock] InvokeModel Request:', {
        modelId,
        body: JSON.stringify(body, null, 2),
      });
    }

    throw new Error(
      'AWS Bedrock invocation not implemented. ' +
      'Please install and integrate @aws-sdk/client-bedrock-runtime. ' +
      'See: https://docs.aws.amazon.com/bedrock/latest/userguide/api-methods-run.html'
    );

    /*
    // Example implementation with AWS SDK:
    import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

    const client = new BedrockRuntimeClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        sessionToken: this.config.sessionToken,
      },
    });

    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(body),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return responseBody as T;
    */
  }

  /**
   * Invokes a Bedrock model with streaming
   *
   * This is a placeholder implementation. In production, use:
   * @aws-sdk/client-bedrock-runtime with InvokeModelWithResponseStreamCommand
   *
   * @param modelId - Model ARN
   * @param body - Request body
   * @returns Async iterable of response chunks
   */
  private async invokeModelWithResponseStream(
    modelId: string,
    body: BedrockRequest
  ): Promise<AsyncIterable<Uint8Array>> {
    if (this.config.debug) {
      console.log('[Bedrock] InvokeModelWithResponseStream Request:', {
        modelId,
        body: JSON.stringify(body, null, 2),
      });
    }

    throw new Error(
      'AWS Bedrock streaming not implemented. ' +
      'Please install and integrate @aws-sdk/client-bedrock-runtime. ' +
      'See: https://docs.aws.amazon.com/bedrock/latest/userguide/api-methods-run.html'
    );

    /*
    // Example implementation with AWS SDK:
    import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

    const client = new BedrockRuntimeClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        sessionToken: this.config.sessionToken,
      },
    });

    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      body: JSON.stringify(body),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await client.send(command);

    if (!response.body) {
      throw new Error('No response body from Bedrock');
    }

    return eventStreamToAsyncIterable(response.body);
    */
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

        const mapped = this.isMappedError(error) ? error as MappedError : mapBedrockError(error);

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
            `[Bedrock] Retry ${attempt + 1}/${this.config.maxRetries} after ${delay}ms: ${mapped.message}`
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
   * Type guard to check if error is already mapped
   */
  private isMappedError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      'message' in error &&
      'statusCode' in error &&
      'isRetryable' in error
    );
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
 * Factory function to create AWS Bedrock provider
 *
 * @param config - Provider configuration
 * @returns Configured Bedrock provider instance
 */
export function createBedrockProvider(config: BedrockConfig): BedrockProvider {
  return new BedrockProvider(config);
}

/**
 * Helper to create provider from environment variables
 *
 * Expects:
 * - AWS_ACCESS_KEY_ID: AWS access key
 * - AWS_SECRET_ACCESS_KEY: AWS secret key
 * - AWS_SESSION_TOKEN (optional): Session token for temporary credentials
 * - AWS_REGION: AWS region
 * - BEDROCK_TIMEOUT (optional): Request timeout in ms
 * - BEDROCK_DEBUG (optional): Enable debug logging
 *
 * @returns Configured Bedrock provider instance
 */
export function createBedrockProviderFromEnv(): BedrockProvider {
  const region = process.env['AWS_REGION'] || process.env['AWS_DEFAULT_REGION'];

  if (!region) {
    throw new Error('AWS_REGION or AWS_DEFAULT_REGION environment variable is required');
  }

  const config: BedrockConfig = {
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
    sessionToken: process.env['AWS_SESSION_TOKEN'],
    region,
    timeout: process.env['BEDROCK_TIMEOUT'] ? parseInt(process.env['BEDROCK_TIMEOUT'], 10) : undefined,
    maxRetries: process.env['BEDROCK_MAX_RETRIES']
      ? parseInt(process.env['BEDROCK_MAX_RETRIES'], 10)
      : undefined,
    debug: process.env['BEDROCK_DEBUG'] === 'true',
  };

  return new BedrockProvider(config);
}
