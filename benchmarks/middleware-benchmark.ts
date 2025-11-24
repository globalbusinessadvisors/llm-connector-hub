/**
 * Middleware Benchmark
 * Measures middleware pipeline execution and overhead
 */

import { runBenchmark, BenchmarkResult, createMockRequest, createMockResponse } from './setup';
import { SCENARIOS } from './config';

/**
 * Mock middleware context
 */
interface MiddlewareContext {
  request: any;
  provider: string;
  metadata: Record<string, unknown>;
  startTime: number;
  attemptCount?: number;
  lastError?: Error;
}

type NextFunction = (context: MiddlewareContext) => Promise<any>;

/**
 * Base middleware interface
 */
interface IMiddleware {
  readonly name: string;
  process(context: MiddlewareContext, next: NextFunction): Promise<any>;
}

/**
 * Mock logging middleware
 */
class LoggingMiddleware implements IMiddleware {
  readonly name = 'logging';

  async process(context: MiddlewareContext, next: NextFunction): Promise<any> {
    // Simulate logging overhead
    const logEntry = {
      timestamp: Date.now(),
      provider: context.provider,
      model: context.request.model,
    };
    // In real scenario, this would write to log
    void logEntry;

    const response = await next(context);

    // Log response
    void { status: 'success', duration: Date.now() - context.startTime };

    return response;
  }
}

/**
 * Mock metrics middleware
 */
class MetricsMiddleware implements IMiddleware {
  readonly name = 'metrics';
  private metrics: Map<string, number[]> = new Map();

  async process(context: MiddlewareContext, next: NextFunction): Promise<any> {
    const start = Date.now();

    const response = await next(context);

    const duration = Date.now() - start;
    const key = `${context.provider}.${context.request.model}`;
    const values = this.metrics.get(key) || [];
    values.push(duration);
    this.metrics.set(key, values);

    return response;
  }
}

/**
 * Mock retry middleware (without actual retries)
 */
class RetryMiddleware implements IMiddleware {
  readonly name = 'retry';

  async process(context: MiddlewareContext, next: NextFunction): Promise<any> {
    // Check if retry is needed (simulate logic)
    const shouldRetry = context.attemptCount && context.attemptCount > 1;
    void shouldRetry;

    return await next(context);
  }
}

/**
 * Mock rate limit middleware
 */
class RateLimitMiddleware implements IMiddleware {
  readonly name = 'rateLimit';
  private tokens: number = 100;
  private lastRefill: number = Date.now();

  async process(context: MiddlewareContext, next: NextFunction): Promise<any> {
    // Token bucket algorithm
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor(timePassed / 10); // 1 token per 10ms

    this.tokens = Math.min(100, this.tokens + tokensToAdd);
    this.lastRefill = now;

    if (this.tokens > 0) {
      this.tokens--;
      return await next(context);
    }

    throw new Error('Rate limit exceeded');
  }
}

/**
 * Mock cache middleware
 */
class CacheMiddleware implements IMiddleware {
  readonly name = 'cache';
  private cache: Map<string, any> = new Map();

  async process(context: MiddlewareContext, next: NextFunction): Promise<any> {
    const cacheKey = this.generateKey(context.request);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Execute and cache
    const response = await next(context);
    this.cache.set(cacheKey, response);

    return response;
  }

  private generateKey(request: any): string {
    return JSON.stringify({
      model: request.model,
      messages: request.messages,
    });
  }
}

/**
 * Mock transformation middleware
 */
class TransformationMiddleware implements IMiddleware {
  readonly name = 'transformation';

  async process(context: MiddlewareContext, next: NextFunction): Promise<any> {
    // Transform request
    const transformedRequest = {
      ...context.request,
      metadata: {
        ...context.metadata,
        transformed: true,
      },
    };

    context.request = transformedRequest;

    const response = await next(context);

    // Transform response
    return {
      ...response,
      transformed: true,
    };
  }
}

/**
 * Mock validation middleware
 */
class ValidationMiddleware implements IMiddleware {
  readonly name = 'validation';

  async process(context: MiddlewareContext, next: NextFunction): Promise<any> {
    // Validate request
    if (!context.request.model) {
      throw new Error('Model is required');
    }
    if (!context.request.messages || context.request.messages.length === 0) {
      throw new Error('Messages are required');
    }

    return await next(context);
  }
}

/**
 * Middleware pipeline
 */
class MiddlewarePipeline {
  private middleware: IMiddleware[] = [];

  use(middleware: IMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  async execute(context: MiddlewareContext, handler: NextFunction): Promise<any> {
    let index = -1;

    const dispatch = async (i: number): Promise<any> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;

      const middleware = this.middleware[i];

      if (!middleware) {
        return await handler(context);
      }

      return await middleware.process(context, (ctx) => dispatch(i + 1));
    };

    return await dispatch(0);
  }
}

/**
 * Benchmark middleware operations
 */
export async function benchmarkMiddleware(): Promise<BenchmarkResult[]> {
  console.log('\n🔬 Running Middleware Benchmarks...\n');

  const results: BenchmarkResult[] = [];

  // Create mock handler
  const mockHandler: NextFunction = async (context: MiddlewareContext) => {
    return createMockResponse();
  };

  // Benchmark individual middleware
  const middlewareTypes = [
    new LoggingMiddleware(),
    new MetricsMiddleware(),
    new RetryMiddleware(),
    new RateLimitMiddleware(),
    new CacheMiddleware(),
    new TransformationMiddleware(),
    new ValidationMiddleware(),
  ];

  console.log('  Individual Middleware:\n');

  for (const middleware of middlewareTypes) {
    const pipeline = new MiddlewarePipeline().use(middleware);
    const context: MiddlewareContext = {
      request: createMockRequest(1),
      provider: 'anthropic',
      metadata: {},
      startTime: Date.now(),
    };

    const result = await runBenchmark(
      `Middleware: ${middleware.name}`,
      async () => {
        await pipeline.execute({ ...context }, mockHandler);
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );

    results.push(result);
    console.log(
      `    ✓ ${result.name}: ${result.averageTime.toFixed(2)}μs (${result.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  // Benchmark pipeline with multiple middleware
  console.log('\n  Middleware Pipelines:\n');

  for (const [key, scenario] of Object.entries(SCENARIOS.middleware)) {
    const pipeline = new MiddlewarePipeline();

    // Add middleware based on scenario
    for (let i = 0; i < scenario.count; i++) {
      pipeline.use(middlewareTypes[i % middlewareTypes.length]);
    }

    const context: MiddlewareContext = {
      request: createMockRequest(1),
      provider: 'anthropic',
      metadata: {},
      startTime: Date.now(),
    };

    const result = await runBenchmark(
      `Pipeline: ${scenario.name} (${scenario.count} middleware)`,
      async () => {
        await pipeline.execute({ ...context }, mockHandler);
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );

    results.push(result);
    console.log(
      `    ✓ ${result.name}: ${result.averageTime.toFixed(2)}μs (${result.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  // Benchmark context creation/destruction
  console.log('\n  Context Operations:\n');

  const contextResult = await runBenchmark(
    'Context Creation',
    () => {
      const context: MiddlewareContext = {
        request: createMockRequest(1),
        provider: 'anthropic',
        metadata: {},
        startTime: Date.now(),
      };
      void context;
    },
    { iterations: 100000, warmupIterations: 1000, collectMemory: true }
  );
  results.push(contextResult);
  console.log(
    `    ✓ ${contextResult.name}: ${contextResult.averageTime.toFixed(2)}μs (${contextResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  // Benchmark context cloning
  const originalContext: MiddlewareContext = {
    request: createMockRequest(5),
    provider: 'anthropic',
    metadata: { foo: 'bar', baz: 123 },
    startTime: Date.now(),
  };

  const cloneResult = await runBenchmark(
    'Context Cloning (spread)',
    () => {
      const cloned = { ...originalContext };
      void cloned;
    },
    { iterations: 100000, warmupIterations: 1000, collectMemory: true }
  );
  results.push(cloneResult);
  console.log(
    `    ✓ ${cloneResult.name}: ${cloneResult.averageTime.toFixed(2)}μs (${cloneResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  // Benchmark context deep cloning
  const deepCloneResult = await runBenchmark(
    'Context Deep Cloning (JSON)',
    () => {
      const cloned = JSON.parse(JSON.stringify(originalContext));
      void cloned;
    },
    { iterations: 10000, warmupIterations: 100, collectMemory: true }
  );
  results.push(deepCloneResult);
  console.log(
    `    ✓ ${deepCloneResult.name}: ${deepCloneResult.averageTime.toFixed(2)}μs (${deepCloneResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  // Benchmark empty pipeline overhead
  const emptyPipeline = new MiddlewarePipeline();
  const emptyContext: MiddlewareContext = {
    request: createMockRequest(1),
    provider: 'anthropic',
    metadata: {},
    startTime: Date.now(),
  };

  const emptyResult = await runBenchmark(
    'Empty Pipeline (baseline)',
    async () => {
      await emptyPipeline.execute({ ...emptyContext }, mockHandler);
    },
    { iterations: 100000, warmupIterations: 1000, collectMemory: true }
  );
  results.push(emptyResult);
  console.log(
    `    ✓ ${emptyResult.name}: ${emptyResult.averageTime.toFixed(2)}μs (${emptyResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  console.log('\n✅ Middleware benchmarks completed\n');

  return results;
}

/**
 * Analyze middleware overhead
 */
export function analyzeMiddlewareOverhead(results: BenchmarkResult[]): void {
  console.log('\n📊 Middleware Overhead Analysis\n');

  const baseline = results.find((r) => r.name.includes('Empty Pipeline'));
  if (!baseline) {
    console.log('Baseline not found');
    return;
  }

  console.log(`Baseline (empty pipeline): ${baseline.averageTime.toFixed(2)}μs\n`);

  // Analyze individual middleware
  console.log('Individual Middleware Overhead:');

  const individualMiddleware = results.filter(
    (r) => r.name.startsWith('Middleware:') && !r.name.includes('Pipeline')
  );

  for (const mw of individualMiddleware) {
    const overhead = mw.averageTime - baseline.averageTime;
    const overheadPercent = (overhead / baseline.averageTime) * 100;

    console.log(
      `  ${mw.name.replace('Middleware: ', '').padEnd(20)} +${overhead.toFixed(2)}μs (+${overheadPercent.toFixed(0)}%)`
    );
  }

  // Analyze pipeline scaling
  console.log('\nPipeline Scaling:');

  const pipelineResults = results.filter((r) => r.name.startsWith('Pipeline:'));

  for (const pipeline of pipelineResults) {
    const middlewareCount = parseInt(pipeline.name.match(/\((\d+) middleware\)/)?.[1] || '0');
    const totalOverhead = pipeline.averageTime - baseline.averageTime;
    const perMiddleware = middlewareCount > 0 ? totalOverhead / middlewareCount : 0;

    console.log(
      `  ${middlewareCount} middleware: ${pipeline.averageTime.toFixed(2)}μs total, ${perMiddleware.toFixed(2)}μs per middleware`
    );
  }

  console.log('');
}

/**
 * Run middleware benchmarks if executed directly
 */
if (require.main === module) {
  benchmarkMiddleware()
    .then((results) => {
      analyzeMiddlewareOverhead(results);
    })
    .catch((error) => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
