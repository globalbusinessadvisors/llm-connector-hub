import { RetryMiddleware, RetryStrategy } from '../retry';
import { createContext } from '../pipeline';
import { CompletionRequest, CompletionResponse } from '@llm-dev-ops/connector-hub-core';

describe('RetryMiddleware', () => {
  const mockRequest: CompletionRequest = {
    messages: [{ role: 'user' as any, content: 'test' }],
    model: 'gpt-4',
  };

  const mockResponse: CompletionResponse = {
    id: 'test-123',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'test response' },
        finishReason: 'stop' as any,
      },
    ],
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful requests', () => {
    it('should pass through on success without retry', async () => {
      const middleware = new RetryMiddleware({ maxAttempts: 3 });
      const context = createContext(mockRequest, 'openai');
      const next = jest.fn().mockResolvedValue(mockResponse);

      const result = await middleware.process(context, next);

      expect(result).toEqual(mockResponse);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry logic', () => {
    it('should retry on retryable errors', async () => {
      const middleware = new RetryMiddleware({
        maxAttempts: 3,
        initialDelay: 10,
      });
      const context = createContext(mockRequest, 'openai');

      let attempts = 0;
      const next = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Network error');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return mockResponse;
      });

      const result = await middleware.process(context, next);

      expect(result).toEqual(mockResponse);
      expect(next).toHaveBeenCalledTimes(3);
      expect(attempts).toBe(3);
    });

    it('should respect maxAttempts', async () => {
      const middleware = new RetryMiddleware({
        maxAttempts: 2,
        initialDelay: 10,
      });
      const context = createContext(mockRequest, 'openai');

      const error = new Error('Persistent error');
      (error as any).code = 'ETIMEDOUT';
      const next = jest.fn().mockRejectedValue(error);

      await expect(middleware.process(context, next)).rejects.toThrow('All retry attempts exhausted');
      expect(next).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const middleware = new RetryMiddleware({
        maxAttempts: 3,
        initialDelay: 100,
        strategy: RetryStrategy.EXPONENTIAL,
        backoffMultiplier: 2,
        jitter: false,
      });
      const context = createContext(mockRequest, 'openai');

      const delays: number[] = [];
      let lastTime = Date.now();

      const next = jest.fn().mockImplementation(async () => {
        const now = Date.now();
        if (delays.length > 0) {
          delays.push(now - lastTime);
        }
        lastTime = now;

        if (delays.length < 2) {
          const error = new Error('Network error');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return mockResponse;
      });

      await middleware.process(context, next);

      // Check exponential backoff (allowing some timing variance)
      expect(delays[0]).toBeGreaterThanOrEqual(90);
      expect(delays[0]).toBeLessThanOrEqual(150);
      expect(delays[1]).toBeGreaterThanOrEqual(190);
      expect(delays[1]).toBeLessThanOrEqual(250);
    });

    it('should not retry non-retryable errors', async () => {
      const middleware = new RetryMiddleware({ maxAttempts: 3 });
      const context = createContext(mockRequest, 'openai');

      const error = new Error('Validation error');
      const next = jest.fn().mockRejectedValue(error);

      await expect(middleware.process(context, next)).rejects.toThrow('All retry attempts exhausted');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const middleware = new RetryMiddleware({
        maxAttempts: 2,
        initialDelay: 10,
        onRetry,
      });
      const context = createContext(mockRequest, 'openai');

      let attempts = 0;
      const next = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Network error');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return mockResponse;
      });

      await middleware.process(context, next);

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        0,
        expect.any(Error),
        expect.any(Number)
      );
    });
  });

  describe('Custom retry logic', () => {
    it('should use custom isRetryable function', async () => {
      const isRetryable = jest.fn().mockReturnValue(true);
      const middleware = new RetryMiddleware({
        maxAttempts: 2,
        initialDelay: 10,
        isRetryable,
      });
      const context = createContext(mockRequest, 'openai');

      let attempts = 0;
      const next = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Custom error');
        }
        return mockResponse;
      });

      await middleware.process(context, next);

      expect(isRetryable).toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(2);
    });

    it('should use custom delay function', async () => {
      const customDelay = jest.fn().mockReturnValue(50);
      const middleware = new RetryMiddleware({
        maxAttempts: 2,
        initialDelay: 100,
        customDelay,
      });
      const context = createContext(mockRequest, 'openai');

      let attempts = 0;
      const next = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Network error');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return mockResponse;
      });

      await middleware.process(context, next);

      expect(customDelay).toHaveBeenCalledWith(0, expect.any(Error));
    });
  });

  describe('Statistics', () => {
    it('should track retry statistics', async () => {
      const middleware = new RetryMiddleware({
        maxAttempts: 3,
        initialDelay: 10,
      });
      const context = createContext(mockRequest, 'openai');

      let attempts = 0;
      const next = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Network error');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return mockResponse;
      });

      await middleware.process(context, next);

      const stats = middleware.getStats();
      expect(stats.totalRetries).toBeGreaterThan(0);
    });
  });
});
