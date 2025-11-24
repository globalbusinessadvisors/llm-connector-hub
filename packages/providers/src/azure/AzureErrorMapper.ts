/**
 * Azure OpenAI Error Mapper
 *
 * Maps Azure OpenAI API errors to unified error types.
 * Azure OpenAI uses the same error format as OpenAI:
 * {
 *   "error": {
 *     "code": "string",
 *     "message": "string",
 *     "param": "string" | null,
 *     "type": "string"
 *   }
 * }
 */

import type { ErrorType } from '@llm-dev-ops/connector-hub-core';

/**
 * Azure OpenAI error response format
 */
export interface AzureError {
  error: {
    code?: string;
    message: string;
    param?: string | null;
    type?: string;
    status?: number;
  };
}

/**
 * Azure OpenAI error codes
 */
export type AzureErrorCode =
  | 'invalid_api_key'
  | 'invalid_request_error'
  | 'rate_limit_exceeded'
  | 'quota_exceeded'
  | 'model_not_found'
  | 'deployment_not_found'
  | 'content_filter'
  | 'context_length_exceeded'
  | 'insufficient_quota'
  | 'server_error'
  | 'service_unavailable'
  | 'timeout';

/**
 * Extended error information
 */
export interface MappedError {
  type: ErrorType;
  message: string;
  statusCode: number;
  isRetryable: boolean;
  retryAfter?: number;
  azureErrorCode?: string;
}

/**
 * Maps Azure OpenAI error to unified error type
 *
 * @param error - Error from Azure OpenAI API
 * @param statusCode - HTTP status code
 * @returns Mapped error information
 */
export function mapAzureError(error: unknown, statusCode?: number): MappedError {
  // Handle Azure error response format
  if (isAzureError(error)) {
    return mapAzureErrorType(error, statusCode);
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
 * Type guard for Azure error format
 */
function isAzureError(error: unknown): error is AzureError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof error.error === 'object' &&
    error.error !== null &&
    'message' in error.error
  );
}

/**
 * Maps Azure error code/type to unified error
 */
function mapAzureErrorType(error: AzureError, statusCode?: number): MappedError {
  const { code, message, type } = error.error;
  const errorCode = code || type || 'unknown';

  // Authentication errors
  if (
    errorCode === 'invalid_api_key' ||
    errorCode === 'Unauthorized' ||
    statusCode === 401
  ) {
    return {
      type: 'authentication',
      message: message || 'Invalid API key. Please check your Azure OpenAI credentials.',
      statusCode: statusCode ?? 401,
      isRetryable: false,
      azureErrorCode: errorCode,
    };
  }

  // Permission/quota errors
  if (
    errorCode === 'insufficient_quota' ||
    errorCode === 'quota_exceeded' ||
    statusCode === 403
  ) {
    return {
      type: 'authentication',
      message:
        message ||
        'Insufficient quota or permission denied. Check your Azure subscription and quotas.',
      statusCode: statusCode ?? 403,
      isRetryable: false,
      azureErrorCode: errorCode,
    };
  }

  // Deployment not found
  if (
    errorCode === 'deployment_not_found' ||
    errorCode === 'DeploymentNotFound' ||
    errorCode === 'model_not_found' ||
    message.toLowerCase().includes('deployment') && message.toLowerCase().includes('not found')
  ) {
    return {
      type: 'invalid_request',
      message:
        message ||
        'Deployment not found. Check your deployment name in Azure Portal.',
      statusCode: statusCode ?? 404,
      isRetryable: false,
      azureErrorCode: errorCode,
    };
  }

  // Rate limit errors
  if (
    errorCode === 'rate_limit_exceeded' ||
    errorCode === 'requests_rate_limit_exceeded' ||
    errorCode === 'tokens_rate_limit_exceeded' ||
    statusCode === 429
  ) {
    return {
      type: 'rate_limit',
      message:
        message ||
        'Rate limit exceeded. Please reduce request frequency or increase quota.',
      statusCode: statusCode ?? 429,
      isRetryable: true,
      retryAfter: extractRetryAfter(message),
      azureErrorCode: errorCode,
    };
  }

  // Context length exceeded
  if (
    errorCode === 'context_length_exceeded' ||
    message.toLowerCase().includes('context length') ||
    message.toLowerCase().includes('maximum context')
  ) {
    return {
      type: 'invalid_request',
      message:
        message ||
        'Context length exceeded. Please reduce the length of your messages.',
      statusCode: statusCode ?? 400,
      isRetryable: false,
      azureErrorCode: errorCode,
    };
  }

  // Content filter
  if (
    errorCode === 'content_filter' ||
    errorCode === 'ResponsibleAIPolicyViolation' ||
    message.toLowerCase().includes('content filter') ||
    message.toLowerCase().includes('content policy')
  ) {
    return {
      type: 'invalid_request',
      message:
        message ||
        'Content was filtered by Azure OpenAI content policy. Please modify your input.',
      statusCode: statusCode ?? 400,
      isRetryable: false,
      azureErrorCode: errorCode,
    };
  }

  // Invalid request
  if (
    errorCode === 'invalid_request_error' ||
    errorCode === 'BadRequest' ||
    (statusCode && statusCode >= 400 && statusCode < 500)
  ) {
    return {
      type: 'invalid_request',
      message: message || 'Invalid request. Please check your request parameters.',
      statusCode: statusCode ?? 400,
      isRetryable: false,
      azureErrorCode: errorCode,
    };
  }

  // Server errors
  if (
    errorCode === 'server_error' ||
    errorCode === 'service_unavailable' ||
    errorCode === 'InternalServerError' ||
    errorCode === 'ServiceUnavailable' ||
    (statusCode && statusCode >= 500 && statusCode < 600)
  ) {
    return {
      type: 'server_error',
      message:
        message || 'Azure OpenAI service error. Please try again later.',
      statusCode: statusCode ?? 500,
      isRetryable: true,
      retryAfter: 30, // Default to 30 seconds for server errors
      azureErrorCode: errorCode,
    };
  }

  // Timeout errors
  if (errorCode === 'timeout' || message.toLowerCase().includes('timeout')) {
    return {
      type: 'timeout',
      message: message || 'Request timed out. Please try again.',
      statusCode: statusCode ?? 408,
      isRetryable: true,
      azureErrorCode: errorCode,
    };
  }

  // Default: unknown error
  return {
    type: 'unknown',
    message: message || 'Unknown error from Azure OpenAI.',
    statusCode: statusCode ?? 500,
    isRetryable: false,
    azureErrorCode: errorCode,
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
      message: message || 'Permission denied. Check your quota and subscription.',
      statusCode,
      isRetryable: false,
    };
  }

  if (statusCode === 404) {
    return {
      type: 'invalid_request',
      message: message || 'Resource not found. Check your deployment name.',
      statusCode,
      isRetryable: false,
    };
  }

  if (statusCode === 408) {
    return {
      type: 'timeout',
      message: message || 'Request timed out.',
      statusCode,
      isRetryable: true,
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
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
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
 * Checks if an error is a deployment error
 */
export function isDeploymentError(error: MappedError): boolean {
  return (
    error.type === 'invalid_request' &&
    (error.azureErrorCode === 'deployment_not_found' ||
      error.azureErrorCode === 'DeploymentNotFound')
  );
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
    message += ' Please check your API key and subscription in Azure Portal.';
  }

  if (isDeploymentError(error)) {
    message +=
      ' Verify your deployment name matches the one in Azure OpenAI Studio.';
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
export function shouldRetry(
  error: MappedError,
  attemptNumber: number,
  maxRetries: number
): boolean {
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
 * Gets retry delay for errors
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
