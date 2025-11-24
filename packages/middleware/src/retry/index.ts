/**
 * RetryMiddleware - Exponential backoff retry logic
 *
 * Provides configurable retry policies with exponential backoff,
 * jitter, and custom retry conditions.
 */

import type {
  IMiddleware,
  MiddlewareContext,
  NextFunction,
  CompletionResponse,
} from '@llm-connector-hub/core';

/**
 * Retry strategy types
 */
export enum RetryStrategy {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  CONSTANT = 'constant',
}

/**
 * Configuration options for RetryMiddleware
 */
export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  strategy?: RetryStrategy;
  backoffMultiplier?: number;
  jitter?: boolean;
  isRetryable?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, delay: number) => void | Promise<void>;
  customDelay?: (attempt: number, error: Error) => number;
}

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'onRetry' | 'isRetryable' | 'customDelay'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  strategy: RetryStrategy.EXPONENTIAL,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Checks if an error is retryable
 *
 * By default, retries network errors, timeouts, and 5xx server errors.
 *
 * @param error - Error to check
 * @returns True if retryable
 */
function defaultIsRetryable(error: Error): boolean {
  // Check for network errors
  const errorCode = (error as any).code;
  if (errorCode) {
    const retryableCodes = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ENETUNREACH',
      'EPIPE',
    ];
    if (retryableCodes.includes(errorCode)) {
      return true;
    }
  }

  // Check for retryable HTTP errors
  const statusCode = (error as any).statusCode || (error as any).status_code;
  if (statusCode) {
    // Retry on 429 (rate limit) and 5xx (server errors)
    if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
      return true;
    }
  }

  // Check if error has a retryable property
  if ('retryable' in error && typeof (error as any).retryable === 'boolean') {
    return (error as any).retryable;
  }

  return false;
}

/**
 * Calculates retry delay based on strategy
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt: number, config: Required<Omit<RetryConfig, 'onRetry' | 'isRetryable' | 'customDelay'>>): number {
  let delay: number;

  switch (config.strategy) {
    case RetryStrategy.EXPONENTIAL:
      delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
      break;
    case RetryStrategy.LINEAR:
      delay = config.initialDelay * (attempt + 1);
      break;
    case RetryStrategy.CONSTANT:
      delay = config.initialDelay;
      break;
    default:
      delay = config.initialDelay;
  }

  // Apply max delay cap
  delay = Math.min(delay, config.maxDelay);

  // Apply jitter if enabled
  if (config.jitter) {
    // Add random jitter of +/- 25%
    const jitterAmount = delay * 0.25;
    delay = delay + (Math.random() * 2 - 1) * jitterAmount;
  }

  return Math.max(0, Math.floor(delay));
}

/**
 * Sleep utility
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * RetryMiddleware - Handles automatic retry with exponential backoff
 *
 * Retries failed requests based on configurable policies.
 * Supports exponential, linear, and constant backoff strategies.
 */
export class RetryMiddleware implements IMiddleware {
  readonly name = 'retry';
  private config: Required<Omit<RetryConfig, 'onRetry' | 'isRetryable' | 'customDelay'>>;
  private isRetryable: (error: Error) => boolean;
  private onRetry?: (attempt: number, error: Error, delay: number) => void | Promise<void>;
  private customDelay?: (attempt: number, error: Error) => number;

  constructor(config: RetryConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.isRetryable = config.isRetryable || defaultIsRetryable;
    this.onRetry = config.onRetry;
    this.customDelay = config.customDelay;
  }

  async process(
    context: MiddlewareContext,
    next: NextFunction
  ): Promise<CompletionResponse> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < this.config.maxAttempts) {
      try {
        // Update attempt count in context
        context.attemptCount = attempt;
        if (lastError) {
          context.lastError = lastError;
        }

        // Execute the next middleware or handler
        const response = await next(context);
        return response;
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        const shouldRetry = this.isRetryable(lastError);

        // If this was the last attempt or error is not retryable, throw
        if (attempt >= this.config.maxAttempts - 1 || !shouldRetry) {
          throw new Error(`All retry attempts exhausted. Last error: ${lastError.message}`);
        }

        // Calculate delay
        const delay = this.customDelay
          ? this.customDelay(attempt, lastError)
          : calculateDelay(attempt, this.config);

        // Call onRetry callback if provided
        if (this.onRetry) {
          await this.onRetry(attempt, lastError, delay);
        }

        // Wait before retrying
        await sleep(delay);

        // Increment attempt counter
        attempt++;
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error(`All retry attempts exhausted. Last error: ${lastError?.message || 'Unknown error'}`);
  }
}
