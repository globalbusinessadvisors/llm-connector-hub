/**
 * OpenAI Error Mapper
 *
 * Maps OpenAI API errors to unified error types.
 * OpenAI returns errors in the format:
 * {
 *   "error": {
 *     "message": "Human-readable error message",
 *     "type": "invalid_request_error" | "authentication_error" | "permission_error" | "rate_limit_error" | "server_error",
 *     "param": null | string,
 *     "code": "invalid_api_key" | "rate_limit_exceeded" | etc.
 *   }
 * }
 */

import type { ErrorType } from '@llm-dev-ops/connector-hub-core';

/**
 * OpenAI error response format
 */
export interface OpenAIError {
  error: {
    message: string;
    type: string;
    param?: string | null;
    code?: string;
  };
}

/**
 * OpenAI error types
 */
export type OpenAIErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'permission_error'
  | 'rate_limit_error'
  | 'server_error'
  | 'api_error';

/**
 * Extended error information
 */
export interface MappedError {
  type: ErrorType;
  message: string;
  statusCode: number;
  isRetryable: boolean;
  retryAfter?: number;
  openaiErrorType?: string;
  openaiErrorCode?: string;
}

/**
 * Maps OpenAI error to unified error type
 *
 * @param error - Error from OpenAI API
 * @param statusCode - HTTP status code
 * @returns Mapped error information
 */
export function mapOpenAIError(error: unknown, statusCode?: number): MappedError {
  // Handle OpenAI error response format
  if (isOpenAIError(error)) {
    return mapOpenAIErrorType(error, statusCode);
  }

  // Handle HTTP errors
  if (statusCode) {
    return mapHttpStatusCode(statusCode, error);
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      type: 'unknown',
      message: error.message,
      statusCode: 500,
      isRetryable: false,
    };
  }

  // Unknown error
  return {
    type: 'unknown',
    message: String(error),
    statusCode: 500,
    isRetryable: false,
  };
}

/**
 * Type guard for OpenAI error format
 */
function isOpenAIError(error: unknown): error is OpenAIError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof error.error === 'object' &&
    error.error !== null &&
    'message' in error.error &&
    'type' in error.error
  );
}

/**
 * Maps OpenAI error type to unified error
 */
function mapOpenAIErrorType(error: OpenAIError, statusCode?: number): MappedError {
  const { type, message, code } = error.error;

  // Handle authentication errors
  if (type === 'authentication_error' || code === 'invalid_api_key') {
    return {
      type: 'authentication',
      message: message || 'Authentication failed. Please check your API key.',
      statusCode: statusCode ?? 401,
      isRetryable: false,
      openaiErrorType: type,
      openaiErrorCode: code,
    };
  }

  // Handle permission errors
  if (type === 'permission_error' || code === 'permission_denied') {
    return {
      type: 'authentication',
      message: message || 'Permission denied. Check your API key permissions.',
      statusCode: statusCode ?? 403,
      isRetryable: false,
      openaiErrorType: type,
      openaiErrorCode: code,
    };
  }

  // Handle rate limit errors
  if (type === 'rate_limit_error' || code === 'rate_limit_exceeded') {
    return {
      type: 'rate_limit',
      message: message || 'Rate limit exceeded. Please slow down your requests.',
      statusCode: statusCode ?? 429,
      isRetryable: true,
      retryAfter: extractRetryAfter(message),
      openaiErrorType: type,
      openaiErrorCode: code,
    };
  }

  // Handle invalid request errors
  if (type === 'invalid_request_error') {
    return {
      type: 'invalid_request',
      message: message || 'Invalid request. Check your request parameters.',
      statusCode: statusCode ?? 400,
      isRetryable: false,
      openaiErrorType: type,
      openaiErrorCode: code,
    };
  }

  // Handle server errors
  if (type === 'server_error' || type === 'api_error') {
    return {
      type: 'server_error',
      message: message || 'OpenAI server error. Please try again.',
      statusCode: statusCode ?? 500,
      isRetryable: true,
      openaiErrorType: type,
      openaiErrorCode: code,
    };
  }

  // Default to unknown error
  return {
    type: 'unknown',
    message: message || 'Unknown error from OpenAI API.',
    statusCode: statusCode ?? 500,
    isRetryable: false,
    openaiErrorType: type,
    openaiErrorCode: code,
  };
}

/**
 * Maps HTTP status code to error type
 */
function mapHttpStatusCode(statusCode: number, error: unknown): MappedError {
  const message = getErrorMessage(error);

  if (statusCode === 401) {
    return {
      type: 'authentication',
      message: message || 'Authentication failed. Invalid API key.',
      statusCode,
      isRetryable: false,
    };
  }

  if (statusCode === 403) {
    return {
      type: 'authentication',
      message: message || 'Permission denied.',
      statusCode,
      isRetryable: false,
    };
  }

  if (statusCode === 404) {
    return {
      type: 'invalid_request',
      message: message || 'Resource not found. Check your model name and endpoint.',
      statusCode,
      isRetryable: false,
    };
  }

  if (statusCode === 429) {
    return {
      type: 'rate_limit',
      message: message || 'Rate limit exceeded.',
      statusCode,
      isRetryable: true,
      retryAfter: extractRetryAfter(message),
    };
  }

  if (statusCode >= 400 && statusCode < 500) {
    return {
      type: 'invalid_request',
      message: message || `Client error: ${statusCode}`,
      statusCode,
      isRetryable: false,
    };
  }

  if (statusCode >= 500 && statusCode < 600) {
    return {
      type: 'server_error',
      message: message || `Server error: ${statusCode}`,
      statusCode,
      isRetryable: true,
    };
  }

  return {
    type: 'unknown',
    message: message || `HTTP error: ${statusCode}`,
    statusCode,
    isRetryable: false,
  };
}

/**
 * Extracts error message from various error formats
 */
function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if ('error' in error) {
      const err = error.error as any;
      if (typeof err === 'string') {
        return err;
      }
      if (err && typeof err === 'object' && 'message' in err) {
        return String(err.message);
      }
    }
  }

  return '';
}

/**
 * Extracts retry-after duration from error message or headers
 */
function extractRetryAfter(message: string): number | undefined {
  // Look for patterns like "retry after 60 seconds" or "wait 30s"
  const patterns = [
    /retry after (\d+)\s*seconds?/i,
    /wait (\d+)\s*s(?:ec(?:ond)?s?)?/i,
    /try again in (\d+)\s*seconds?/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const seconds = parseInt(match[1], 10);
      if (!isNaN(seconds) && seconds > 0) {
        return seconds;
      }
    }
  }

  return undefined;
}

/**
 * Checks if an error is retryable
 */
export function isRetryableError(error: MappedError): boolean {
  return error.isRetryable;
}

/**
 * Checks if an error is an authentication error
 */
export function isAuthenticationError(error: MappedError): boolean {
  return error.type === 'authentication';
}

/**
 * Checks if an error is a rate limit error
 */
export function isRateLimitError(error: MappedError): boolean {
  return error.type === 'rate_limit';
}

/**
 * Checks if an error is a server error
 */
export function isServerError(error: MappedError): boolean {
  return error.type === 'server_error';
}

/**
 * Creates a user-friendly error message
 */
export function formatErrorMessage(error: MappedError): string {
  let message = error.message;

  if (error.type === 'rate_limit' && error.retryAfter) {
    message += ` Please retry after ${error.retryAfter} seconds.`;
  }

  if (error.type === 'authentication') {
    message += ' Please check your API key at https://platform.openai.com/api-keys';
  }

  return message;
}

/**
 * Determines if request should be retried based on error
 *
 * @param error - Mapped error
 * @param attemptNumber - Current retry attempt (0-based)
 * @param maxRetries - Maximum number of retries
 * @returns True if should retry
 */
export function shouldRetry(error: MappedError, attemptNumber: number, maxRetries: number): boolean {
  // Don't retry if max attempts reached
  if (attemptNumber >= maxRetries) {
    return false;
  }

  // Only retry if error is marked as retryable
  return error.isRetryable;
}

/**
 * Calculates exponential backoff delay
 *
 * @param attemptNumber - Current retry attempt (0-based)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
  attemptNumber: number,
  baseDelay: number = 1000,
  maxDelay: number = 60000
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const delay = baseDelay * Math.pow(2, attemptNumber);

  // Add jitter (random 0-25% variation)
  const jitter = delay * 0.25 * Math.random();

  // Cap at maxDelay
  return Math.min(delay + jitter, maxDelay);
}

/**
 * Gets retry delay for rate limit errors
 *
 * @param error - Mapped error
 * @param attemptNumber - Current retry attempt
 * @returns Delay in milliseconds
 */
export function getRetryDelay(error: MappedError, attemptNumber: number): number {
  // Use retry-after if available
  if (error.retryAfter) {
    return error.retryAfter * 1000;
  }

  // Use exponential backoff
  return calculateBackoff(attemptNumber);
}
