/**
 * Tests for GoogleErrorMapper
 */

import { describe, it, expect } from 'vitest';
import {
  mapHttpStatusToErrorType,
  isRetryableStatusCode,
  mapGoogleError,
  createNetworkError,
  createTimeoutError,
  createConfigError,
  createStreamError,
  createSafetyError,
  shouldRetry,
  calculateRetryDelay,
  GoogleProviderError,
  type GoogleErrorResponse,
} from '../GoogleErrorMapper';

describe('GoogleErrorMapper', () => {
  describe('mapHttpStatusToErrorType', () => {
    it('should map authentication errors', () => {
      expect(mapHttpStatusToErrorType(401)).toBe('authentication');
      expect(mapHttpStatusToErrorType(403)).toBe('authentication');
    });

    it('should map rate limit errors', () => {
      expect(mapHttpStatusToErrorType(429)).toBe('rate_limit');
    });

    it('should map client errors', () => {
      expect(mapHttpStatusToErrorType(400)).toBe('invalid_request');
      expect(mapHttpStatusToErrorType(404)).toBe('invalid_request');
      expect(mapHttpStatusToErrorType(422)).toBe('invalid_request');
    });

    it('should map server errors', () => {
      expect(mapHttpStatusToErrorType(500)).toBe('server_error');
      expect(mapHttpStatusToErrorType(503)).toBe('server_error');
    });

    it('should default to unknown', () => {
      expect(mapHttpStatusToErrorType(200)).toBe('unknown');
    });
  });

  describe('isRetryableStatusCode', () => {
    it('should mark rate limits as retryable', () => {
      expect(isRetryableStatusCode(429)).toBe(true);
    });

    it('should mark server errors as retryable', () => {
      expect(isRetryableStatusCode(500)).toBe(true);
      expect(isRetryableStatusCode(503)).toBe(true);
    });

    it('should mark client errors as non-retryable', () => {
      expect(isRetryableStatusCode(400)).toBe(false);
      expect(isRetryableStatusCode(401)).toBe(false);
      expect(isRetryableStatusCode(404)).toBe(false);
    });
  });

  describe('mapGoogleError', () => {
    it('should map UNAUTHENTICATED error', () => {
      const response: GoogleErrorResponse = {
        error: {
          code: 401,
          message: 'Invalid API key',
          status: 'UNAUTHENTICATED',
        },
      };

      const error = mapGoogleError(response, 401);

      expect(error.type).toBe('authentication');
      expect(error.message).toBe('Invalid API key');
      expect(error.statusCode).toBe(401);
      expect(error.googleStatus).toBe('UNAUTHENTICATED');
      expect(error.retryable).toBe(false);
    });

    it('should map RESOURCE_EXHAUSTED error', () => {
      const response: GoogleErrorResponse = {
        error: {
          code: 429,
          message: 'Rate limit exceeded',
          status: 'RESOURCE_EXHAUSTED',
        },
      };

      const error = mapGoogleError(response, 429);

      expect(error.type).toBe('rate_limit');
      expect(error.retryable).toBe(true);
    });

    it('should map INVALID_ARGUMENT error', () => {
      const response: GoogleErrorResponse = {
        error: {
          code: 400,
          message: 'Invalid request',
          status: 'INVALID_ARGUMENT',
        },
      };

      const error = mapGoogleError(response, 400);

      expect(error.type).toBe('invalid_request');
      expect(error.retryable).toBe(false);
    });

    it('should map DEADLINE_EXCEEDED error', () => {
      const response: GoogleErrorResponse = {
        error: {
          code: 504,
          message: 'Deadline exceeded',
          status: 'DEADLINE_EXCEEDED',
        },
      };

      const error = mapGoogleError(response, 504);

      expect(error.type).toBe('timeout');
      expect(error.retryable).toBe(true);
    });

    it('should map UNAVAILABLE error', () => {
      const response: GoogleErrorResponse = {
        error: {
          code: 503,
          message: 'Service unavailable',
          status: 'UNAVAILABLE',
        },
      };

      const error = mapGoogleError(response, 503);

      expect(error.type).toBe('network');
      expect(error.retryable).toBe(true);
    });

    it('should include error details', () => {
      const response: GoogleErrorResponse = {
        error: {
          code: 400,
          message: 'Bad request',
          status: 'INVALID_ARGUMENT',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.BadRequest',
              reason: 'FIELD_VIOLATION',
            },
          ],
        },
      };

      const error = mapGoogleError(response, 400);

      expect(error.details).toHaveProperty('details');
    });
  });

  describe('createNetworkError', () => {
    it('should create network error', () => {
      const originalError = new Error('Connection failed');
      const error = createNetworkError(originalError);

      expect(error.type).toBe('network');
      expect(error.message).toContain('Connection failed');
      expect(error.retryable).toBe(true);
    });
  });

  describe('createTimeoutError', () => {
    it('should create timeout error', () => {
      const error = createTimeoutError(30000);

      expect(error.type).toBe('timeout');
      expect(error.message).toContain('30000ms');
      expect(error.retryable).toBe(true);
      expect(error.googleStatus).toBe('DEADLINE_EXCEEDED');
    });
  });

  describe('createConfigError', () => {
    it('should create config error', () => {
      const error = createConfigError('Invalid API key format');

      expect(error.type).toBe('invalid_request');
      expect(error.message).toBe('Invalid API key format');
      expect(error.retryable).toBe(false);
      expect(error.googleStatus).toBe('INVALID_ARGUMENT');
    });
  });

  describe('createStreamError', () => {
    it('should create stream error', () => {
      const error = createStreamError('Stream closed unexpectedly');

      expect(error.type).toBe('server_error');
      expect(error.message).toContain('Stream closed unexpectedly');
      expect(error.retryable).toBe(false);
    });

    it('should include original error', () => {
      const originalError = new Error('Parse failed');
      const error = createStreamError('Stream error', originalError);

      expect(error.details).toHaveProperty('originalError', 'Parse failed');
    });
  });

  describe('createSafetyError', () => {
    it('should create safety error', () => {
      const error = createSafetyError();

      expect(error.type).toBe('invalid_request');
      expect(error.message).toContain('safety filters');
      expect(error.retryable).toBe(false);
      expect(error.googleStatus).toBe('SAFETY');
    });

    it('should include safety ratings', () => {
      const ratings = [
        { category: 'HARM_CATEGORY_HARASSMENT', probability: 'HIGH' },
      ];
      const error = createSafetyError(ratings);

      expect(error.message).toContain('HARM_CATEGORY_HARASSMENT=HIGH');
      expect(error.details).toHaveProperty('safetyRatings', ratings);
    });
  });

  describe('shouldRetry', () => {
    it('should not retry if max attempts reached', () => {
      const error = new GoogleProviderError('Error', 'rate_limit', 429, undefined, undefined, true);

      expect(shouldRetry(error, 3, 3)).toBe(false);
    });

    it('should retry if error is retryable and under max attempts', () => {
      const error = new GoogleProviderError('Error', 'rate_limit', 429, undefined, undefined, true);

      expect(shouldRetry(error, 1, 3)).toBe(true);
    });

    it('should not retry if error is not retryable', () => {
      const error = new GoogleProviderError('Error', 'authentication', 401, undefined, undefined, false);

      expect(shouldRetry(error, 0, 3)).toBe(false);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      expect(calculateRetryDelay(0, 1000)).toBeGreaterThanOrEqual(1000);
      expect(calculateRetryDelay(0, 1000)).toBeLessThanOrEqual(1250);

      expect(calculateRetryDelay(1, 1000)).toBeGreaterThanOrEqual(2000);
      expect(calculateRetryDelay(1, 1000)).toBeLessThanOrEqual(2500);

      expect(calculateRetryDelay(2, 1000)).toBeGreaterThanOrEqual(4000);
      expect(calculateRetryDelay(2, 1000)).toBeLessThanOrEqual(5000);
    });

    it('should respect max delay', () => {
      const delay = calculateRetryDelay(10, 1000, 5000);

      expect(delay).toBeLessThanOrEqual(6250); // 5000 + 25% jitter
    });

    it('should add jitter', () => {
      const delays = Array.from({ length: 10 }, () => calculateRetryDelay(1, 1000));

      // All delays should be different due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('GoogleProviderError', () => {
    it('should create error with all properties', () => {
      const error = new GoogleProviderError(
        'Test error',
        'rate_limit',
        429,
        1234,
        'RESOURCE_EXHAUSTED',
        true,
        { extra: 'data' }
      );

      expect(error.name).toBe('GoogleProviderError');
      expect(error.message).toBe('Test error');
      expect(error.type).toBe('rate_limit');
      expect(error.statusCode).toBe(429);
      expect(error.googleErrorCode).toBe(1234);
      expect(error.googleStatus).toBe('RESOURCE_EXHAUSTED');
      expect(error.retryable).toBe(true);
      expect(error.details).toEqual({ extra: 'data' });
    });
  });
});
