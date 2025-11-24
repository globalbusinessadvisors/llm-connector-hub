# @llm-connector-hub/middleware

Composable middleware components for LLM Connector Hub.

## Features

- **RetryMiddleware**: Exponential backoff retry logic with configurable policies
- **RateLimitMiddleware**: Token bucket and sliding window rate limiting algorithms
- **CircuitBreaker**: Circuit breaker pattern for fault tolerance
- **LoggingMiddleware**: Structured logging with pino and sensitive data sanitization
- **MetricsMiddleware**: Prometheus metrics collection
- **Pipeline**: Middleware execution orchestration

## Installation

```bash
npm install @llm-connector-hub/middleware
```

## Usage

### Basic Example

```typescript
import {
  Pipeline,
  RetryMiddleware,
  RateLimitMiddleware,
  CircuitBreakerMiddleware,
  LoggingMiddleware,
  MetricsMiddleware,
  createContext,
} from '@llm-connector-hub/middleware';

// Create pipeline
const pipeline = new Pipeline();

// Add middleware (executed in order of priority)
pipeline.use(new LoggingMiddleware({ level: 'info' }), { priority: 10 });
pipeline.use(new MetricsMiddleware(), { priority: 20 });
pipeline.use(new RateLimitMiddleware({ maxRequests: 100, windowMs: 60000 }), { priority: 30 });
pipeline.use(new CircuitBreakerMiddleware({ failureThreshold: 5 }), { priority: 40 });
pipeline.use(new RetryMiddleware({ maxAttempts: 3 }), { priority: 50 });

// Execute request through pipeline
const context = createContext(request, 'openai');
const response = await pipeline.execute(context, async (ctx) => {
  // Your provider handler here
  return provider.complete(ctx.request);
});
```

### Retry Middleware

```typescript
import { RetryMiddleware, RetryStrategy } from '@llm-connector-hub/middleware';

const retryMiddleware = new RetryMiddleware({
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  strategy: RetryStrategy.EXPONENTIAL,
  jitter: true,
  onRetry: async (attempt, error, delay) => {
    console.log(`Retry attempt ${attempt} after ${delay}ms`);
  },
});
```

### Rate Limit Middleware

```typescript
import {
  RateLimitMiddleware,
  RateLimitAlgorithm,
} from '@llm-connector-hub/middleware';

// Token bucket algorithm
const rateLimiter = new RateLimitMiddleware({
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
  keyBy: 'provider', // Rate limit per provider
  onLimitReached: 'queue', // Queue requests when limit is reached
});

// Sliding window algorithm
const slidingWindowLimiter = new RateLimitMiddleware({
  maxRequests: 50,
  windowMs: 60000,
  algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
});
```

### Circuit Breaker Middleware

```typescript
import { CircuitBreakerMiddleware } from '@llm-connector-hub/middleware';

const circuitBreaker = new CircuitBreakerMiddleware({
  failureThreshold: 5,
  failureWindow: 60000,
  resetTimeout: 30000,
  successThreshold: 2,
  timeout: 10000,
  onOpen: () => console.log('Circuit opened'),
  onClose: () => console.log('Circuit closed'),
});

// Get circuit status
const breaker = circuitBreaker.getBreaker('openai');
console.log(breaker.getStatus());
```

### Logging Middleware

```typescript
import { LoggingMiddleware, LogLevel } from '@llm-connector-hub/middleware';

const logger = new LoggingMiddleware({
  level: LogLevel.INFO,
  logRequests: true,
  logResponses: true,
  logErrors: true,
  prettyPrint: process.env.NODE_ENV === 'development',
  sanitizerOptions: {
    redactEmails: true,
    customFields: ['customSecret'],
  },
});
```

### Metrics Middleware

```typescript
import { MetricsMiddleware } from '@llm-connector-hub/middleware';

const metrics = new MetricsMiddleware({
  trackTokens: true,
  trackErrors: true,
  trackProviderHealth: true,
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(await metrics.getMetrics());
});
```

### Pipeline Management

```typescript
import { Pipeline } from '@llm-connector-hub/middleware';

const pipeline = new Pipeline();

// Add middleware
pipeline.use(retryMiddleware, { priority: 10, enabled: true });
pipeline.use(rateLimiter, { priority: 20 });

// Disable middleware
pipeline.disable('retry');

// Enable middleware
pipeline.enable('retry');

// Remove middleware
pipeline.remove('retry');

// Get statistics
console.log(pipeline.getStats());

// Clear all middleware
pipeline.clear();
```

## Middleware Order

Middleware are executed based on their priority (lower numbers execute first):

1. Logging (priority: 10) - Log incoming requests
2. Metrics (priority: 20) - Start tracking metrics
3. Rate Limiting (priority: 30) - Check rate limits
4. Circuit Breaker (priority: 40) - Check circuit state
5. Retry (priority: 50) - Execute with retry logic

## Architecture

All middleware implement the `IMiddleware` interface:

```typescript
interface IMiddleware {
  readonly name: string;
  process(context: MiddlewareContext, next: NextFunction): Promise<CompletionResponse>;
  initialize?(config: MiddlewareConfig): Promise<void>;
  onError?(error: Error, context: MiddlewareContext): Promise<CompletionResponse | undefined>;
  cleanup?(): Promise<void>;
}
```

## Testing

```bash
npm test
npm run test:coverage
```

## License

MIT OR Apache-2.0
