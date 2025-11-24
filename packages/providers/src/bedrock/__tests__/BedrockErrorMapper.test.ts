/**
 * Tests for BedrockErrorMapper
 */

import { describe, it, expect } from 'vitest';
import {
  mapBedrockError,
  isRetryableError,
  isAuthenticationError,
  isRateLimitError,
  formatErrorMessage,
  shouldRetry,
  calculateBackoff,
  getRetryDelay,
} from '../BedrockErrorMapper';
import type { BedrockError } from '../BedrockErrorMapper';

describe('BedrockErrorMapper', () => {
  describe('mapBedrockError', () => {
    it('should map AccessDeniedException', () => {
      const error: BedrockError = {
        __type: 'AccessDeniedException',
        message: 'User is not authorized',
      };

      const mapped = mapBedrockError(error);

      expect(mapped.type).toBe('authentication');
      expect(mapped.statusCode).toBe(403);
      expect(mapped.isRetryable).toBe(false);
    });

    it('should map ThrottlingException', () => {
      const error: BedrockError = {
        __type: 'ThrottlingException',
        message: 'Rate exceeded',
      };

      const mapped = mapBedrockError(error);

      expect(mapped.type).toBe('rate_limit');
      expect(mapped.statusCode).toBe(429);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should map ServiceQuotaExceededException', () => {
      const error: BedrockError = {
        __type: 'ServiceQuotaExceededException',
        message: 'Service quota exceeded',
      };

      const mapped = mapBedrockError(error);

      expect(mapped.type).toBe('rate_limit');
      expect(mapped.statusCode).toBe(429);
      expect(mapped.isRetryable).toBe(false);
    });

    it('should map ValidationException', () => {
      const error: BedrockError = {
        __type: 'ValidationException',
        message: 'Invalid parameters',
      };

      const mapped = mapBedrockError(error);

      expect(mapped.type).toBe('invalid_request');
      expect(mapped.statusCode).toBe(400);
      expect(mapped.isRetryable).toBe(false);
    });

    it('should map ModelNotReadyException', () => {
      const error: BedrockError = {
        __type: 'ModelNotReadyException',
        message: 'Model is still loading',
      };

      const mapped = mapBedrockError(error);

      expect(mapped.type).toBe('server_error');
      expect(mapped.statusCode).toBe(503);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should map InternalServerException', () => {
      const error: BedrockError = {
        __type: 'InternalServerException',
        message: 'Internal error',
      };

      const mapped = mapBedrockError(error);

      expect(mapped.type).toBe('server_error');
      expect(mapped.statusCode).toBe(500);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should map HTTP 403 status code', () => {
      const mapped = mapBedrockError({}, 403);

      expect(mapped.type).toBe('authentication');
      expect(mapped.statusCode).toBe(403);
      expect(mapped.isRetryable).toBe(false);
    });

    it('should map HTTP 429 status code', () => {
      const mapped = mapBedrockError({}, 429);

      expect(mapped.type).toBe('rate_limit');
      expect(mapped.statusCode).toBe(429);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should map HTTP 500 status code', () => {
      const mapped = mapBedrockError({}, 500);

      expect(mapped.type).toBe('server_error');
      expect(mapped.statusCode).toBe(500);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should handle Error objects', () => {
      const error = new Error('Network error');
      const mapped = mapBedrockError(error);

      expect(mapped.type).toBe('unknown');
      expect(mapped.message).toBe('Network error');
      expect(mapped.isRetryable).toBe(false);
    });

    it('should preserve Bedrock error type', () => {
      const error: BedrockError = {
        __type: 'ModelTimeoutException',
        message: 'Model timed out',
      };

      const mapped = mapBedrockError(error);

      expect(mapped.bedrockErrorType).toBe('ModelTimeoutException');
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
        statusCode: 403,
        isRetryable: false,
      };

      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('isAuthenticationError', () => {
    it('should return true for authentication errors', () => {
      const error = {
        type: 'authentication' as const,
        message: 'Access denied',
        statusCode: 403,
        isRetryable: false,
      };

      expect(isAuthenticationError(error)).toBe(true);
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
        message: 'Access denied',
        statusCode: 403,
        isRetryable: false,
      };

      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('Access denied');
      expect(formatted).toContain('AWS credentials');
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
    });

    it('should return false for non-retryable errors', () => {
      const error = {
        type: 'authentication' as const,
        message: 'Access denied',
        statusCode: 403,
        isRetryable: false,
      };

      expect(shouldRetry(error, 0, 3)).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', () => {
      expect(calculateBackoff(0, 1000)).toBeGreaterThanOrEqual(1000);
      expect(calculateBackoff(1, 1000)).toBeGreaterThanOrEqual(2000);
    });

    it('should cap at max delay', () => {
      const delay = calculateBackoff(10, 1000, 10000);
      expect(delay).toBeLessThanOrEqual(10000);
    });

    it('should add jitter', () => {
      const delays = Array.from({ length: 10 }, () => calculateBackoff(0, 1000));
      const uniqueDelays = new Set(delays);

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
      expect(delay).toBe(45000);
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
    });
  });
});
