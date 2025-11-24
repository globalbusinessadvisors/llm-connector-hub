/**
 * AWS Bedrock Error Mapper
 *
 * Maps AWS Bedrock errors to unified error types.
 * Bedrock returns errors through AWS SDK exceptions with specific error codes.
 */

import type { ErrorType } from '@llm-dev-ops/connector-hub-core';

/**
 * AWS Bedrock error codes
 */
export type BedrockErrorCode =
  | 'AccessDeniedException'
  | 'ModelTimeoutException'
  | 'ModelErrorException'
  | 'ModelNotReadyException'
  | 'ServiceQuotaExceededException'
  | 'ThrottlingException'
  | 'ValidationException'
  | 'ResourceNotFoundException'
  | 'ModelStreamErrorException'
  | 'InternalServerException'
  | 'ServiceUnavailableException';

/**
 * Extended error information
 */
export interface MappedError {
  type: ErrorType;
  message: string;
  statusCode: number;
  isRetryable: boolean;
  retryAfter?: number;
  bedrockErrorCode?: string;
}

/**
 * AWS SDK error structure
 */
interface AWSError {
  name?: string;
  message?: string;
  code?: string;
  statusCode?: number;
  $metadata?: {
    httpStatusCode?: number;
  };
}

/**
 * Maps AWS Bedrock error to unified error type
 *
 * @param error - Error from Bedrock API
 * @returns Mapped error information
 */
export function mapBedrockError(error: unknown): MappedError {
  // Handle AWS SDK errors
  if (isAWSError(error)) {
    return mapAWSError(error);
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
 * Type guard for AWS SDK error format
 */
function isAWSError(error: unknown): error is AWSError {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('name' in error || 'code' in error)
  );
}

/**
 * Maps AWS SDK error to unified error
 */
function mapAWSError(error: AWSError): MappedError {
  const errorCode = error.name || error.code || 'UnknownError';
  const message = error.message || 'Unknown AWS Bedrock error';
  const statusCode = error.$metadata?.httpStatusCode || error.statusCode || 500;

  switch (errorCode) {
    case 'AccessDeniedException':
      return {
        type: 'authentication',
        message: message || 'Access denied. Check your AWS credentials and IAM permissions.',
        statusCode: 403,
        isRetryable: false,
        bedrockErrorCode: errorCode,
      };

    case 'ValidationException':
      return {
        type: 'invalid_request',
        message: message || 'Invalid request parameters.',
        statusCode: 400,
        isRetryable: false,
        bedrockErrorCode: errorCode,
      };

    case 'ResourceNotFoundException':
      return {
        type: 'invalid_request',
        message: message || 'Model or resource not found. Check your model ARN.',
        statusCode: 404,
        isRetryable: false,
        bedrockErrorCode: errorCode,
      };

    case 'ThrottlingException':
    case 'ServiceQuotaExceededException':
      return {
        type: 'rate_limit',
        message: message || 'Rate limit exceeded. Please slow down your requests.',
        statusCode: 429,
        isRetryable: true,
        retryAfter: extractRetryAfter(message),
        bedrockErrorCode: errorCode,
      };

    case 'ModelTimeoutException':
      return {
        type: 'timeout',
        message: message || 'Model invocation timed out.',
        statusCode: 408,
        isRetryable: true,
        bedrockErrorCode: errorCode,
      };

    case 'ModelNotReadyException':
      return {
        type: 'server_error',
        message: message || 'Model is not ready. Please try again shortly.',
        statusCode: 503,
        isRetryable: true,
        retryAfter: 30,
        bedrockErrorCode: errorCode,
      };

    case 'ModelErrorException':
    case 'ModelStreamErrorException':
      return {
        type: 'server_error',
        message: message || 'Model error during invocation.',
        statusCode: 500,
        isRetryable: true,
        bedrockErrorCode: errorCode,
      };

    case 'InternalServerException':
    case 'ServiceUnavailableException':
      return {
        type: 'server_error',
        message: message || 'AWS Bedrock service error. Please retry.',
        statusCode: statusCode,
        isRetryable: true,
        bedrockErrorCode: errorCode,
      };

    case 'CredentialsProviderError':
    case 'UnrecognizedClientException':
      return {
        type: 'authentication',
        message: message || 'Invalid AWS credentials.',
        statusCode: 401,
        isRetryable: false,
        bedrockErrorCode: errorCode,
      };

    case 'TimeoutError':
    case 'RequestTimeout':
      return {
        type: 'timeout',
        message: message || 'Request timed out.',
        statusCode: 408,
        isRetryable: true,
        bedrockErrorCode: errorCode,
      };

    default:
      // Check status code for generic errors
      if (statusCode === 401 || statusCode === 403) {
        return {
          type: 'authentication',
          message,
          statusCode,
          isRetryable: false,
          bedrockErrorCode: errorCode,
        };
      }

      if (statusCode === 429) {
        return {
          type: 'rate_limit',
          message,
          statusCode,
          isRetryable: true,
          bedrockErrorCode: errorCode,
        };
      }

      if (statusCode >= 500 && statusCode < 600) {
        return {
          type: 'server_error',
          message,
          statusCode,
          isRetryable: true,
          bedrockErrorCode: errorCode,
        };
      }

      return {
        type: 'unknown',
        message,
        statusCode,
        isRetryable: false,
        bedrockErrorCode: errorCode,
      };
  }
}

/**
 * Extracts retry-after duration from error message
 */
function extractRetryAfter(message: string): number | undefined {
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
    message += ' Please check your AWS credentials and IAM permissions at https://console.aws.amazon.com/';
  }

  if (error.bedrockErrorCode) {
    message += ` (Error Code: ${error.bedrockErrorCode})`;
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
