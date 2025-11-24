/**
 * Tests for error classes
 */

import { describe, expect, it } from 'vitest';

import {
  AuthenticationError,
  InvalidRequestError,
  NetworkError,
  RateLimitError,
  ServerError,
  TimeoutError,
  createErrorFromStatus,
} from '@llm-connector-hub/core';

describe('Error classes', () => {
  it('should create AuthenticationError', () => {
    const error = new AuthenticationError('Invalid API key', 'openai');
    expect(error.type).toBe('authentication');
    expect(error.status_code).toBe(401);
    expect(error.retryable).toBe(false);
    expect(error.provider).toBe('openai');
  });

  it('should create RateLimitError', () => {
    const error = new RateLimitError('Rate limit exceeded', 'anthropic');
    expect(error.type).toBe('rate_limit');
    expect(error.status_code).toBe(429);
    expect(error.retryable).toBe(true);
  });

  it('should create InvalidRequestError', () => {
    const error = new InvalidRequestError('Invalid parameters');
    expect(error.type).toBe('invalid_request');
    expect(error.retryable).toBe(false);
  });

  it('should create ServerError', () => {
    const error = new ServerError('Internal server error', 'openai', 500);
    expect(error.type).toBe('server_error');
    expect(error.retryable).toBe(true);
  });

  it('should create TimeoutError', () => {
    const error = new TimeoutError('Request timeout');
    expect(error.type).toBe('timeout');
    expect(error.retryable).toBe(true);
  });

  it('should create NetworkError', () => {
    const error = new NetworkError('Connection failed');
    expect(error.type).toBe('network');
    expect(error.retryable).toBe(true);
  });
});

describe('createErrorFromStatus', () => {
  it('should create AuthenticationError for 401', () => {
    const error = createErrorFromStatus(401, 'Unauthorized');
    expect(error.type).toBe('authentication');
  });

  it('should create RateLimitError for 429', () => {
    const error = createErrorFromStatus(429, 'Too many requests');
    expect(error.type).toBe('rate_limit');
  });

  it('should create InvalidRequestError for 400', () => {
    const error = createErrorFromStatus(400, 'Bad request');
    expect(error.type).toBe('invalid_request');
  });

  it('should create ServerError for 500', () => {
    const error = createErrorFromStatus(500, 'Internal error');
    expect(error.type).toBe('server_error');
  });

  it('should create TimeoutError for 408', () => {
    const error = createErrorFromStatus(408, 'Request timeout');
    expect(error.type).toBe('timeout');
  });
});
