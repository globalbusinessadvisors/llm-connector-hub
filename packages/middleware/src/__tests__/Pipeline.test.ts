import { Pipeline } from '../pipeline';
import { IMiddleware, MiddlewareContext, NextFunction, CompletionResponse } from '@llm-dev-ops/connector-hub-core';
import { createContext } from '../pipeline';

// Mock middleware for testing
class MockMiddleware implements IMiddleware {
  public readonly name: string;
  public processCallCount = 0;
  public initializeCallCount = 0;
  public cleanupCallCount = 0;

  constructor(name: string) {
    this.name = name;
  }

  async initialize(): Promise<void> {
    this.initializeCallCount++;
  }

  async process(context: MiddlewareContext, next: NextFunction): Promise<CompletionResponse> {
    this.processCallCount++;
    context.metadata[this.name] = true;
    return next(context);
  }

  async cleanup(): Promise<void> {
    this.cleanupCallCount++;
  }
}

describe('Pipeline', () => {
  let pipeline: Pipeline;

  beforeEach(() => {
    pipeline = new Pipeline();
  });

  afterEach(() => {
    pipeline.clear();
  });

  describe('Middleware management', () => {
    it('should add middleware to pipeline', () => {
      const middleware = new MockMiddleware('test');
      pipeline.use(middleware);

      expect(pipeline.has('test')).toBe(true);
      expect(pipeline.get('test')).toBe(middleware);
    });

    it('should remove middleware from pipeline', () => {
      const middleware = new MockMiddleware('test');
      pipeline.use(middleware);

      const removed = pipeline.remove('test');

      expect(removed).toBe(true);
      expect(pipeline.has('test')).toBe(false);
    });

    it('should call cleanup when removing middleware', async () => {
      const middleware = new MockMiddleware('test');
      pipeline.use(middleware);

      pipeline.remove('test');

      // Give cleanup time to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(middleware.cleanupCallCount).toBe(1);
    });

    it('should clear all middleware', async () => {
      const m1 = new MockMiddleware('m1');
      const m2 = new MockMiddleware('m2');

      pipeline.use(m1);
      pipeline.use(m2);

      pipeline.clear();

      // Give cleanup time to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(pipeline.getMiddleware()).toHaveLength(0);
      expect(m1.cleanupCallCount).toBe(1);
      expect(m2.cleanupCallCount).toBe(1);
    });
  });

  describe('Middleware execution', () => {
    it('should execute middleware in priority order', async () => {
      const order: string[] = [];

      class OrderMiddleware implements IMiddleware {
        constructor(public readonly name: string) {}

        async process(context: MiddlewareContext, next: NextFunction): Promise<CompletionResponse> {
          order.push(`before-${this.name}`);
          const result = await next(context);
          order.push(`after-${this.name}`);
          return result;
        }
      }

      pipeline.use(new OrderMiddleware('m1'), { priority: 30 });
      pipeline.use(new OrderMiddleware('m2'), { priority: 10 });
      pipeline.use(new OrderMiddleware('m3'), { priority: 20 });

      const context = createContext(
        { messages: [], model: 'test' },
        'test-provider'
      );

      const handler = jest.fn().mockResolvedValue({
        id: 'test',
        object: 'completion',
        created: Date.now(),
        model: 'test',
        choices: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      });

      await pipeline.execute(context, handler);

      expect(order).toEqual([
        'before-m2', // priority 10
        'before-m3', // priority 20
        'before-m1', // priority 30
        'after-m1',
        'after-m3',
        'after-m2',
      ]);
    });

    it('should skip disabled middleware', async () => {
      const m1 = new MockMiddleware('m1');
      const m2 = new MockMiddleware('m2');

      pipeline.use(m1, { enabled: true });
      pipeline.use(m2, { enabled: false });

      const context = createContext(
        { messages: [], model: 'test' },
        'test-provider'
      );

      const handler = jest.fn().mockResolvedValue({
        id: 'test',
        object: 'completion',
        created: Date.now(),
        model: 'test',
        choices: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      });

      await pipeline.execute(context, handler);

      expect(m1.processCallCount).toBe(1);
      expect(m2.processCallCount).toBe(0);
    });

    it('should enable and disable middleware', async () => {
      const middleware = new MockMiddleware('test');
      pipeline.use(middleware);

      const context = createContext(
        { messages: [], model: 'test' },
        'test-provider'
      );

      const handler = jest.fn().mockResolvedValue({
        id: 'test',
        object: 'completion',
        created: Date.now(),
        model: 'test',
        choices: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      });

      // Execute with middleware enabled
      await pipeline.execute(context, handler);
      expect(middleware.processCallCount).toBe(1);

      // Disable and execute
      pipeline.disable('test');
      await pipeline.execute(context, handler);
      expect(middleware.processCallCount).toBe(1); // Still 1

      // Enable and execute
      pipeline.enable('test');
      await pipeline.execute(context, handler);
      expect(middleware.processCallCount).toBe(2);
    });
  });

  describe('Error handling', () => {
    it('should propagate errors if no handler catches them', async () => {
      class ErrorMiddleware implements IMiddleware {
        public readonly name = 'error';

        async process(context: MiddlewareContext, next: NextFunction): Promise<CompletionResponse> {
          return next(context);
        }
      }

      pipeline.use(new ErrorMiddleware());

      const context = createContext(
        { messages: [], model: 'test' },
        'test-provider'
      );

      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);

      await expect(pipeline.execute(context, handler)).rejects.toThrow('Test error');
    });

    it('should use error handlers for recovery', async () => {
      const recoveryResponse: CompletionResponse = {
        id: 'recovery',
        object: 'completion',
        created: Date.now(),
        model: 'test',
        choices: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };

      class RecoveryMiddleware implements IMiddleware {
        public readonly name = 'recovery';

        async process(context: MiddlewareContext, next: NextFunction): Promise<CompletionResponse> {
          return next(context);
        }

        async onError(error: Error): Promise<CompletionResponse> {
          return recoveryResponse;
        }
      }

      pipeline.use(new RecoveryMiddleware());

      const context = createContext(
        { messages: [], model: 'test' },
        'test-provider'
      );

      const handler = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await pipeline.execute(context, handler);
      expect(result).toEqual(recoveryResponse);
    });
  });

  describe('Configuration', () => {
    it('should update middleware configuration', () => {
      const middleware = new MockMiddleware('test');
      pipeline.use(middleware, { priority: 10 });

      pipeline.updateConfig('test', { priority: 20 });

      const config = pipeline.getConfig('test');
      expect(config?.priority).toBe(20);
    });

    it('should return stats', () => {
      const m1 = new MockMiddleware('m1');
      const m2 = new MockMiddleware('m2');

      pipeline.use(m1, { enabled: true });
      pipeline.use(m2, { enabled: false });

      const stats = pipeline.getStats();

      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
      expect(stats.middlewareNames).toContain('m1');
      expect(stats.middlewareNames).toContain('m2');
    });
  });
});
