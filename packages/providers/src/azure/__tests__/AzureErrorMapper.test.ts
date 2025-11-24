/**
 * Tests for AzureErrorMapper
 */

import { describe, it, expect } from 'vitest';
import {
  mapAzureError,
  isRetryableError,
  isAuthenticationError,
  isRateLimitError,
  formatErrorMessage,
  shouldRetry,
  calculateBackoff,
  getRetryDelay,
} from '../AzureErrorMapper';
import type { AzureError } from '../AzureErrorMapper';

describe('AzureErrorMapper', () => {
  describe('mapAzureError', () => {
    it('should map authentication error', () => {
      const error: AzureError = {
        error: {
          message: 'Invalid API key',
          type: 'invalid_request_error',
          code: '401',
        },
      };

      const mapped = mapAzureError(error);

      expect(mapped.type).toBe('authentication');
      expect(mapped.statusCode).toBe(401);
      expect(mapped.isRetryable).toBe(false);
    });

    it('should map rate limit error', () => {
      const error: AzureError = {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
          code: '429',
        },
      };

      const mapped = mapAzureError(error);

      expect(mapped.type).toBe('rate_limit');
      expect(mapped.statusCode).toBe(429);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should map server error', () => {
      const error: AzureError = {
        error: {
          message: 'Internal server error',
          type: 'server_error',
          code: '500',
        },
      };

      const mapped = mapAzureError(error);

      expect(mapped.type).toBe('server_error');
      expect(mapped.statusCode).toBe(500);
      expect(mapped.isRetryable).toBe(true);
    });

    it('should extract retry-after from message', () => {
      const error: AzureError = {
        error: {
          message: 'Rate limit exceeded. Please retry after 30 seconds.',
          type: 'rate_limit_error',
          code: '429',
        },
      };

      const mapped = mapAzureError(error);

      expect(mapped.retryAfter).toBe(30);
    });

    it('should handle Error objects', () => {
      const error = new Error('Network error');
      const mapped = mapAzureError(error);

      expect(mapped.type).toBe('unknown');
      expect(mapped.message).toBe('Network error');
      expect(mapped.isRetryable).toBe(false);
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
        message: 'Invalid API key',
        statusCode: 401,
        isRetryable: false,
      };

      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('Invalid API key');
      expect(formatted).toContain('portal.azure.com');
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
  });
});
