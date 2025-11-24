/**
 * Error classes and utilities for LLM Connector Hub
 *
 * Provides standardized error handling with specific error types
 * for authentication, rate limiting, invalid requests, server errors,
 * timeouts, and network issues.
 */

import type { ErrorType } from '../types';

/**
 * Base error class for all provider errors
 *
 * Extends the standard Error class with additional metadata
 * for error type, status code, provider, and retry behavior.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly status_code?: number,
    public readonly provider?: string,
    public readonly retryable: boolean = false,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Authentication error (401)
 *
 * Thrown when API credentials are invalid or missing.
 * This error is not retryable as the credentials need to be fixed.
 */
export class AuthenticationError extends ProviderError {
  constructor(message: string, provider?: string, details?: unknown) {
    super(message, 'authentication', 401, provider, false, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Rate limit error (429)
 *
 * Thrown when the API rate limit has been exceeded.
 * This error is retryable after a backoff period.
 */
export class RateLimitError extends ProviderError {
  constructor(message: string, provider?: string, details?: unknown) {
    super(message, 'rate_limit', 429, provider, true, details);
    this.name = 'RateLimitError';
  }
}

/**
 * Invalid request error (400)
 *
 * Thrown when the request parameters are invalid.
 * This error is not retryable as the request needs to be fixed.
 */
export class InvalidRequestError extends ProviderError {
  constructor(message: string, provider?: string, details?: unknown) {
    super(message, 'invalid_request', 400, provider, false, details);
    this.name = 'InvalidRequestError';
  }
}

/**
 * Server error (500+)
 *
 * Thrown when the API server encounters an error.
 * This error is retryable as the server issue may be temporary.
 */
export class ServerError extends ProviderError {
  constructor(message: string, provider?: string, status_code: number = 500, details?: unknown) {
    super(message, 'server_error', status_code, provider, true, details);
    this.name = 'ServerError';
  }
}

/**
 * Timeout error (408)
 *
 * Thrown when a request times out.
 * This error is retryable as the timeout may be temporary.
 */
export class TimeoutError extends ProviderError {
  constructor(message: string, provider?: string, details?: unknown) {
    super(message, 'timeout', 408, provider, true, details);
    this.name = 'TimeoutError';
  }
}

/**
 * Network error
 *
 * Thrown when a network connection fails.
 * This error is retryable as the network issue may be temporary.
 */
export class NetworkError extends ProviderError {
  constructor(message: string, provider?: string, details?: unknown) {
    super(message, 'network', undefined, provider, true, details);
    this.name = 'NetworkError';
  }
}

/**
 * Creates a ProviderError from an HTTP status code
 *
 * Maps common HTTP status codes to specific error types:
 * - 400: InvalidRequestError
 * - 401: AuthenticationError
 * - 408: TimeoutError
 * - 429: RateLimitError
 * - 500+: ServerError
 * - Other: Generic ProviderError
 *
 * @param statusCode - HTTP status code
 * @param message - Error message
 * @param provider - Provider name (optional)
 * @param details - Additional error details (optional)
 * @returns Specific error instance based on status code
 */
export function createErrorFromStatus(
  statusCode: number,
  message: string,
  provider?: string,
  details?: unknown
): ProviderError {
  switch (statusCode) {
    case 400:
      return new InvalidRequestError(message, provider, details);
    case 401:
      return new AuthenticationError(message, provider, details);
    case 408:
      return new TimeoutError(message, provider, details);
    case 429:
      return new RateLimitError(message, provider, details);
    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message, provider, statusCode, details);
    default:
      if (statusCode >= 500) {
        return new ServerError(message, provider, statusCode, details);
      }
      return new ProviderError(message, 'unknown', statusCode, provider, false, details);
  }
}
