/**
 * Tests for OpenAIErrorMapper
 */

import { describe, it, expect } from 'vitest';
import {
  mapOpenAIError,
  isRetryableError,
  isAuthenticationError,
  isRateLimitError,
  isServerError,
  formatErrorMessage,
  shouldRetry,
  calculateBackoff,
  getRetryDelay,
} from '../OpenAIErrorMapper';
import type { OpenAIError } from '../OpenAIErrorMapper';

describe('OpenAIErrorMapper', () => {
  describe('mapOpenAIError', () => {
    it('should map authentication_error', () => {
      const error: OpenAIError = {
        error: {
          message: 'Invalid API key',
          type: 'authentication_error',
          code: 'invalid_api_key',
        },
      };

      const mapped = mapOpenAIError(error);

      expect(mapped.type).toBe('authentication');
      expect(mapped.statusCode).toBe(401);
      expect(mapped.isRetryable).toBe(false);
      expect(mapped.message).toContain('Invalid API key');
    });

    it('should map permission_error', () => {
      const error: OpenAIError = {
        error: {
          message: 'Access denied',
          type: 'permission_error',
          code: 'permission_denied',
        },
      };

      const mapped = mapOpenAIError(error);

      expect(mapped.type).toBe('authentication');
      expect(mapped.statusCode).toBe(403);
      expect(mapped.isRetryable).toBe(false);
    });

    it('should map rate_limit_error', () => {
      const error: OpenAIError = {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded',
        },
      };

      const mapped = mapOpenAIError(error);

      expect(mapped.type).toBe('rate_limit');
      expect(mapped.statusCode).toBe(429);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should map invalid_request_error', () => {
      const error: OpenAIError = {
        error: {
          message: 'Invalid parameters',
          type: 'invalid_request_error',
        },
      };

      const mapped = mapOpenAIError(error);

      expect(mapped.type).toBe('invalid_request');
      expect(mapped.statusCode).toBe(400);
      expect(mapped.isRetryable).toBe(false);
    });

    it('should map server_error', () => {
      const error: OpenAIError = {
        error: {
          message: 'Internal error',
          type: 'server_error',
        },
      };

      const mapped = mapOpenAIError(error);

      expect(mapped.type).toBe('server_error');
      expect(mapped.statusCode).toBe(500);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should map api_error', () => {
      const error: OpenAIError = {
        error: {
          message: 'API error',
          type: 'api_error',
        },
      };

      const mapped = mapOpenAIError(error);

      expect(mapped.type).toBe('server_error');
      expect(mapped.statusCode).toBe(500);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should extract retry-after from rate limit message', () => {
      const error: OpenAIError = {
        error: {
          message: 'Rate limit exceeded. Please retry after 30 seconds.',
          type: 'rate_limit_error',
        },
      };

      const mapped = mapOpenAIError(error);

      expect(mapped.retryAfter).toBe(30);
    });

    it('should map HTTP 401 status code', () => {
      const mapped = mapOpenAIError({}, 401);

      expect(mapped.type).toBe('authentication');
      expect(mapped.statusCode).toBe(401);
      expect(mapped.isRetryable).toBe(false);
    });

    it('should map HTTP 403 status code', () => {
      const mapped = mapOpenAIError({}, 403);

      expect(mapped.type).toBe('authentication');
      expect(mapped.statusCode).toBe(403);
      expect(mapped.isRetryable).toBe(false);
    });

    it('should map HTTP 404 status code', () => {
      const mapped = mapOpenAIError({}, 404);

      expect(mapped.type).toBe('invalid_request');
      expect(mapped.statusCode).toBe(404);
      expect(mapped.isRetryable).toBe(false);
    });

    it('should map HTTP 429 status code', () => {
      const mapped = mapOpenAIError({}, 429);

      expect(mapped.type).toBe('rate_limit');
      expect(mapped.statusCode).toBe(429);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should map HTTP 500 status code', () => {
      const mapped = mapOpenAIError({}, 500);

      expect(mapped.type).toBe('server_error');
      expect(mapped.statusCode).toBe(500);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should map HTTP 4xx status codes', () => {
      const mapped = mapOpenAIError({}, 400);

      expect(mapped.type).toBe('invalid_request');
      expect(mapped.statusCode).toBe(400);
      expect(mapped.isRetryable).toBe(false);
    });

    it('should map HTTP 5xx status codes', () => {
      const mapped = mapOpenAIError({}, 503);

      expect(mapped.type).toBe('server_error');
      expect(mapped.statusCode).toBe(503);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should handle Error objects', () => {
      const error = new Error('Network error');
      const mapped = mapOpenAIError(error);

      expect(mapped.type).toBe('unknown');
      expect(mapped.message).toBe('Network error');
      expect(mapped.isRetryable).toBe(false);
    });

    it('should handle string errors', () => {
      const mapped = mapOpenAIError('Something went wrong');

      expect(mapped.type).toBe('unknown');
      expect(mapped.message).toBe('Something went wrong');
    });

    it('should preserve OpenAI error type and code', () => {
      const error: OpenAIError = {
        error: {
          message: 'Invalid model',
          type: 'invalid_request_error',
          code: 'model_not_found',
        },
      };

      const mapped = mapOpenAIError(error);

      expect(mapped.openaiErrorType).toBe('invalid_request_error');
      expect(mapped.openaiErrorCode).toBe('model_not_found');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable errors', () => {
      const error = {
        type: 'rate_limit' as const,
        message: 'Rate limited',
        statusCode: 429,
        isRetryable: true,
      };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = {
        type: 'authentication' as const,
        message: 'Auth failed',
        statusCode: 401,
        isRetryable: false,
      };

      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('isAuthenticationError', () => {
    it('should return true for authentication errors', () => {
      const error = {
        type: 'authentication' as const,
        message: 'Invalid key',
        statusCode: 401,
        isRetryable: false,
      };

      expect(isAuthenticationError(error)).toBe(true);
    });

    it('should return false for other error types', () => {
      const error = {
        type: 'rate_limit' as const,
        message: 'Rate limited',
        statusCode: 429,
        isRetryable: true,
      };

      expect(isAuthenticationError(error)).toBe(false);
    });
  });

  describe('isRateLimitError', () => {
    it('should return true for rate limit errors', () => {
      const error = {
        type: 'rate_limit' as const,
        message: 'Rate limited',
        statusCode: 429,
        isRetryable: true,
      };

      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return false for other error types', () => {
      const error = {
        type: 'server_error' as const,
        message: 'Server error',
        statusCode: 500,
        isRetryable: true,
      };

      expect(isRateLimitError(error)).toBe(false);
    });
  });

  describe('isServerError', () => {
    it('should return true for server errors', () => {
      const error = {
        type: 'server_error' as const,
        message: 'Server error',
        statusCode: 500,
        isRetryable: true,
      };

      expect(isServerError(error)).toBe(true);
    });

    it('should return false for other error types', () => {
      const error = {
        type: 'authentication' as const,
        message: 'Auth failed',
        statusCode: 401,
        isRetryable: false,
      };

      expect(isServerError(error)).toBe(false);
    });
  });

  describe('formatErrorMessage', () => {
    it('should format rate limit error with retry after', () => {
      const error = {
        type: 'rate_limit' as const,
        message: 'Rate limit exceeded',
        statusCode: 429,
        isRetryable: true,
        retryAfter: 30,
      };

      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('Rate limit exceeded');
      expect(formatted).toContain('retry after 30 seconds');
    });

    it('should add help text for authentication errors', () => {
      const error = {
        type: 'authentication' as const,
        message: 'Invalid API key',
        statusCode: 401,
        isRetryable: false,
      };

      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('Invalid API key');
      expect(formatted).toContain('https://platform.openai.com/api-keys');
    });

    it('should pass through message for other errors', () => {
      const error = {
        type: 'server_error' as const,
        message: 'Internal server error',
        statusCode: 500,
        isRetryable: true,
      };

      const formatted = formatErrorMessage(error);

      expect(formatted).toBe('Internal server error');
    });
  });

  describe('shouldRetry', () => {
    it('should return true for retryable error within retry limit', () => {
      const error = {
        type: 'rate_limit' as const,
        message: 'Rate limited',
        statusCode: 429,
        isRetryable: true,
      };

      expect(shouldRetry(error, 0, 3)).toBe(true);
      expect(shouldRetry(error, 1, 3)).toBe(true);
      expect(shouldRetry(error, 2, 3)).toBe(true);
    });

    it('should return false when max retries reached', () => {
      const error = {
        type: 'rate_limit' as const,
        message: 'Rate limited',
        statusCode: 429,
        isRetryable: true,
      };

      expect(shouldRetry(error, 3, 3)).toBe(false);
      expect(shouldRetry(error, 4, 3)).toBe(false);
    });

    it('should return false for non-retryable errors', () => {
      const error = {
        type: 'authentication' as const,
        message: 'Invalid key',
        statusCode: 401,
        isRetryable: false,
      };

      expect(shouldRetry(error, 0, 3)).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', () => {
      expect(calculateBackoff(0, 1000)).toBeGreaterThanOrEqual(1000);
      expect(calculateBackoff(0, 1000)).toBeLessThanOrEqual(1250);

      expect(calculateBackoff(1, 1000)).toBeGreaterThanOrEqual(2000);
      expect(calculateBackoff(1, 1000)).toBeLessThanOrEqual(2500);

      expect(calculateBackoff(2, 1000)).toBeGreaterThanOrEqual(4000);
      expect(calculateBackoff(2, 1000)).toBeLessThanOrEqual(5000);
    });

    it('should cap at max delay', () => {
      const delay = calculateBackoff(10, 1000, 10000);
      expect(delay).toBeLessThanOrEqual(10000);
    });

    it('should add jitter', () => {
      const delays = Array.from({ length: 10 }, () => calculateBackoff(0, 1000));
      const uniqueDelays = new Set(delays);

      // Should have some variation due to jitter
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('getRetryDelay', () => {
    it('should use retryAfter if available', () => {
      const error = {
        type: 'rate_limit' as const,
        message: 'Rate limited',
        statusCode: 429,
        isRetryable: true,
        retryAfter: 45,
      };

      const delay = getRetryDelay(error, 0);
      expect(delay).toBe(45000); // 45 seconds in milliseconds
    });

    it('should use exponential backoff if retryAfter not available', () => {
      const error = {
        type: 'server_error' as const,
        message: 'Server error',
        statusCode: 500,
        isRetryable: true,
      };

      const delay = getRetryDelay(error, 0);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(1250);
    });
  });
});
