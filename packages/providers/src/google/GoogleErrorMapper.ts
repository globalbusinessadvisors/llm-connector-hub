/**
 * Google AI Error Mapper
 *
 * Maps Google AI API errors to standardized error types.
 * Handles HTTP status codes, API error responses, and network errors.
 */

import type { ErrorType } from '@llm-connector-hub/core';

/**
 * Google AI API error response structure
 */
export interface GoogleErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
    details?: Array<{
      '@type': string;
      reason?: string;
      domain?: string;
      metadata?: Record<string, string>;
    }>;
  };
}

/**
 * Standardized error class for Google AI provider
 */
export class GoogleProviderError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly statusCode?: number,
    public readonly googleErrorCode?: number,
    public readonly googleStatus?: string,
    public readonly retryable: boolean = false,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GoogleProviderError';
  }
}

/**
 * Maps HTTP status code to error type
 *
 * @param statusCode - HTTP status code
 * @returns Standardized error type
 */
export function mapHttpStatusToErrorType(statusCode: number): ErrorType {
  if (statusCode === 401 || statusCode === 403) {
    return 'authentication';
  }

  if (statusCode === 429) {
    return 'rate_limit';
  }

  if (statusCode >= 400 && statusCode < 500) {
    return 'invalid_request';
  }

  if (statusCode >= 500) {
    return 'server_error';
  }

  return 'unknown';
}

/**
 * Determines if an error is retryable based on status code
 *
 * @param statusCode - HTTP status code
 * @returns True if the error is retryable
 */
export function isRetryableStatusCode(statusCode: number): boolean {
  // Retry on rate limits and server errors
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

/**
 * Maps Google AI error response to standardized error
 *
 * @param response - Google AI error response
 * @param statusCode - HTTP status code
 * @returns Standardized Google provider error
 */
export function mapGoogleError(
  response: GoogleErrorResponse,
  statusCode: number
): GoogleProviderError {
  const error = response.error;
  const errorType = mapGoogleErrorCodeToType(error.code, error.status);
  const retryable = isRetryableError(error.code, error.status);

  // Extract additional context from details
  const details: Record<string, unknown> = {
    code: error.code,
    status: error.status,
  };

  if (error.details && error.details.length > 0) {
    details['details'] = error.details;
  }

  return new GoogleProviderError(
    error.message,
    errorType,
    statusCode,
    error.code,
    error.status,
    retryable,
    details
  );
}

/**
 * Maps Google AI error code and status to standardized error type
 *
 * @param code - Google error code
 * @param status - Google error status
 * @returns Standardized error type
 */
function mapGoogleErrorCodeToType(code: number, status: string): ErrorType {
  // Map based on status string (more specific)
  switch (status) {
    case 'UNAUTHENTICATED':
    case 'PERMISSION_DENIED':
      return 'authentication';

    case 'RESOURCE_EXHAUSTED':
      return 'rate_limit';

    case 'INVALID_ARGUMENT':
    case 'FAILED_PRECONDITION':
    case 'OUT_OF_RANGE':
      return 'invalid_request';

    case 'DEADLINE_EXCEEDED':
      return 'timeout';

    case 'NOT_FOUND':
      return 'invalid_request';

    case 'ALREADY_EXISTS':
    case 'ABORTED':
    case 'CANCELLED':
      return 'invalid_request';

    case 'INTERNAL':
    case 'UNKNOWN':
    case 'DATA_LOSS':
      return 'server_error';

    case 'UNAVAILABLE':
      return 'network';

    case 'UNIMPLEMENTED':
      return 'invalid_request';

    default:
      // Fall back to HTTP status code mapping
      return mapHttpStatusToErrorType(code);
  }
}

/**
 * Determines if a Google AI error is retryable
 *
 * @param code - Google error code
 * @param status - Google error status
 * @returns True if the error should be retried
 */
function isRetryableError(code: number, status: string): boolean {
  // Retryable statuses
  const retryableStatuses = [
    'RESOURCE_EXHAUSTED', // Rate limit
    'UNAVAILABLE', // Service unavailable
    'DEADLINE_EXCEEDED', // Timeout
    'INTERNAL', // Internal server error
    'UNKNOWN', // Unknown error (might be transient)
  ];

  if (retryableStatuses.includes(status)) {
    return true;
  }

  // Also check HTTP status code
  return isRetryableStatusCode(code);
}

/**
 * Parses error from HTTP response
 *
 * @param response - HTTP response object
 * @returns Standardized error
 */
export async function parseErrorFromResponse(
  response: Response
): Promise<GoogleProviderError> {
  const statusCode = response.status;

  try {
    // Try to parse JSON error response
    const data = (await response.json()) as GoogleErrorResponse;

    if (data.error) {
      return mapGoogleError(data, statusCode);
    }
  } catch {
    // If parsing fails, create error from status
  }

  // Fallback to generic error based on status code
  const errorType = mapHttpStatusToErrorType(statusCode);
  const retryable = isRetryableStatusCode(statusCode);

  let message = `Google AI API error: ${response.statusText || 'Unknown error'}`;

  // Add specific messages for common status codes
  switch (statusCode) {
    case 401:
      message = 'Invalid Google AI API key';
      break;
    case 403:
      message = 'Google AI API access forbidden';
      break;
    case 429:
      message = 'Google AI rate limit exceeded';
      break;
    case 500:
      message = 'Google AI internal server error';
      break;
    case 503:
      message = 'Google AI service unavailable';
      break;
  }

  return new GoogleProviderError(message, errorType, statusCode, undefined, undefined, retryable);
}

/**
 * Creates error for network failures
 *
 * @param error - Original error
 * @returns Standardized network error
 */
export function createNetworkError(error: Error): GoogleProviderError {
  return new GoogleProviderError(
    `Network error: ${error.message}`,
    'network',
    undefined,
    undefined,
    undefined,
    true, // Network errors are retryable
    { originalError: error.message }
  );
}

/**
 * Creates error for timeout
 *
 * @param timeoutMs - Timeout duration in milliseconds
 * @returns Standardized timeout error
 */
export function createTimeoutError(timeoutMs: number): GoogleProviderError {
  return new GoogleProviderError(
    `Request timed out after ${timeoutMs}ms`,
    'timeout',
    undefined,
    undefined,
    'DEADLINE_EXCEEDED',
    true, // Timeouts are retryable
    { timeout: timeoutMs }
  );
}

/**
 * Creates error for invalid configuration
 *
 * @param message - Error message
 * @returns Standardized configuration error
 */
export function createConfigError(message: string): GoogleProviderError {
  return new GoogleProviderError(
    message,
    'invalid_request',
    undefined,
    undefined,
    'INVALID_ARGUMENT',
    false,
    { configError: true }
  );
}

/**
 * Creates error for streaming failures
 *
 * @param message - Error message
 * @param originalError - Original error if available
 * @returns Standardized streaming error
 */
export function createStreamError(message: string, originalError?: Error): GoogleProviderError {
  return new GoogleProviderError(
    `Streaming error: ${message}`,
    'server_error',
    undefined,
    undefined,
    undefined,
    false,
    { streamError: true, originalError: originalError?.message }
  );
}

/**
 * Creates error for content filtering
 *
 * @param safetyRatings - Safety ratings from response
 * @returns Standardized content filter error
 */
export function createSafetyError(safetyRatings?: Array<{ category: string; probability: string }>): GoogleProviderError {
  const message = safetyRatings
    ? `Content blocked by safety filters: ${safetyRatings
        .map((r) => `${r.category}=${r.probability}`)
        .join(', ')}`
    : 'Content blocked by safety filters';

  return new GoogleProviderError(
    message,
    'invalid_request',
    undefined,
    undefined,
    'SAFETY',
    false,
    { safetyRatings }
  );
}

/**
 * Determines if an error should trigger a retry
 *
 * @param error - Error to check
 * @param attemptNumber - Current attempt number (0-indexed)
 * @param maxRetries - Maximum number of retries
 * @returns True if should retry
 */
export function shouldRetry(
  error: GoogleProviderError,
  attemptNumber: number,
  maxRetries: number
): boolean {
  // Don't retry if max attempts reached
  if (attemptNumber >= maxRetries) {
    return false;
  }

  // Only retry if error is marked as retryable
  return error.retryable;
}

/**
 * Calculates backoff delay for retry
 *
 * Uses exponential backoff with jitter
 *
 * @param attemptNumber - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  attemptNumber: number,
  baseDelayMs = 1000,
  maxDelayMs = 60000
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter (random 0-25% of delay)
  const jitter = Math.random() * 0.25 * cappedDelay;

  return Math.floor(cappedDelay + jitter);
}

/**
 * Extracts retry-after header from response
 *
 * @param response - HTTP response
 * @returns Retry delay in milliseconds, or null if not present
 */
export function extractRetryAfter(response: Response): number | null {
  const retryAfter = response.headers.get('retry-after');

  if (!retryAfter) {
    return null;
  }

  // Try parsing as seconds
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  try {
    const date = new Date(retryAfter);
    const now = new Date();
    const delay = date.getTime() - now.getTime();
    return delay > 0 ? delay : null;
  } catch {
    return null;
  }
}
