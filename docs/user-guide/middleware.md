# Middleware Guide

Middleware provides cross-cutting concerns like retry logic, logging, caching, and rate limiting in LLM Connector Hub.

## Table of Contents

1. [Overview](#overview)
2. [Built-in Middleware](#built-in-middleware)
3. [Middleware Pipeline](#middleware-pipeline)
4. [Custom Middleware](#custom-middleware)
5. [Advanced Patterns](#advanced-patterns)

---

## Overview

Middleware intercepts requests and responses, allowing you to add functionality without modifying provider code.

### Middleware Interface

```typescript
interface Middleware {
  process(
    request: CompletionRequest,
    next: (req: CompletionRequest) => Promise<CompletionResponse>
  ): Promise<CompletionResponse>;
}
```

### Adding Middleware

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';
import { RetryMiddleware, LoggingMiddleware } from '@llm-connector-hub/middleware';

const hub = new ConnectorHub();

// Add middleware
hub.use(new RetryMiddleware({ maxAttempts: 3 }));
hub.use(new LoggingMiddleware({ level: 'info' }));
```

---

## Built-in Middleware

### Retry Middleware

Automatically retries failed requests with configurable backoff strategies.

```typescript
import { RetryMiddleware } from '@llm-connector-hub/middleware';

const retryMiddleware = new RetryMiddleware({
  maxAttempts: 3,
  backoff: 'exponential', // 'linear' | 'exponential' | 'constant'
  baseDelay: 1000,
  maxDelay: 30000,

  // Retry conditions
  retryOn: {
    statusCodes: [429, 500, 502, 503, 504],
    errorTypes: ['rate_limit', 'server_error', 'timeout']
  },

  // Callbacks
  onRetry: (attempt, error) => {
    console.log(`Retry attempt ${attempt}: ${error.message}`);
  }
});

hub.use(retryMiddleware);
```

**Backoff Strategies:**

```typescript
// Exponential: 1s, 2s, 4s, 8s, 16s...
backoff: 'exponential'

// Linear: 1s, 2s, 3s, 4s, 5s...
backoff: 'linear'

// Constant: 1s, 1s, 1s, 1s, 1s...
backoff: 'constant'
```

### Logging Middleware

Logs requests, responses, and errors.

```typescript
import { LoggingMiddleware } from '@llm-connector-hub/middleware';

const loggingMiddleware = new LoggingMiddleware({
  level: 'info', // 'debug' | 'info' | 'warn' | 'error'

  // What to log
  includeRequestBody: true,
  includeResponseBody: true,
  includeMetadata: true,
  includeDuration: true,

  // Format
  format: 'json', // 'json' | 'pretty' | 'simple'

  // Redact sensitive data
  redactKeys: ['apiKey', 'authorization'],

  // Custom logger
  logger: customLogger // or console
});

hub.use(loggingMiddleware);
```

**Output Example:**

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "provider": "openai",
  "model": "gpt-4",
  "duration": 1234,
  "tokens": {
    "prompt": 100,
    "completion": 200,
    "total": 300
  }
}
```

### Cache Middleware

Caches responses to reduce costs and improve performance.

```typescript
import { CacheMiddleware } from '@llm-connector-hub/middleware';

const cacheMiddleware = new CacheMiddleware({
  type: 'memory', // 'memory' | 'redis' | 'custom'
  ttl: 3600, // 1 hour in seconds
  maxSize: 1000, // For memory cache

  // Custom cache key generation
  keyGenerator: (request) => {
    return `${request.provider}:${request.model}:${hashMessages(request.messages)}`;
  },

  // Cache conditions
  shouldCache: (request, response) => {
    return response.status === 'success' && request.messages.length > 0;
  }
});

hub.use(cacheMiddleware);
```

**Redis Cache:**

```typescript
const cacheMiddleware = new CacheMiddleware({
  type: 'redis',
  redis: {
    url: 'redis://localhost:6379',
    keyPrefix: 'llm:cache:',
    db: 0,
    password: process.env.REDIS_PASSWORD
  },
  ttl: 3600
});
```

### Rate Limit Middleware

Prevents exceeding provider rate limits.

```typescript
import { RateLimitMiddleware } from '@llm-connector-hub/middleware';

const rateLimitMiddleware = new RateLimitMiddleware({
  strategy: 'token-bucket', // 'token-bucket' | 'fixed-window' | 'sliding-window'
  maxRequests: 100,
  windowMs: 60000, // 1 minute

  // Token bucket specific
  refillRate: 10, // tokens per second
  bucketSize: 100,

  // Per-provider limits
  providerLimits: {
    openai: { maxRequests: 50, windowMs: 60000 },
    anthropic: { maxRequests: 30, windowMs: 60000 }
  },

  onRateLimitExceeded: (provider, retryAfter) => {
    console.warn(`Rate limit exceeded for ${provider}. Retry after ${retryAfter}ms`);
  }
});

hub.use(rateLimitMiddleware);
```

### Metrics Middleware

Collects metrics for monitoring and observability.

```typescript
import { MetricsMiddleware } from '@llm-connector-hub/middleware';

const metricsMiddleware = new MetricsMiddleware({
  enabled: true,
  prefix: 'llm_connector',

  // Metrics to collect
  collectDuration: true,
  collectTokenUsage: true,
  collectErrors: true,
  collectCacheHits: true,

  // Labels
  labels: ['provider', 'model', 'status'],

  // Backend
  backend: 'prometheus', // 'prometheus' | 'statsd' | 'custom'

  prometheus: {
    port: 9090,
    path: '/metrics'
  }
});

hub.use(metricsMiddleware);
```

**Available Metrics:**

- `llm_connector_requests_total` - Total requests
- `llm_connector_request_duration_seconds` - Request duration
- `llm_connector_tokens_total` - Token usage
- `llm_connector_errors_total` - Error count
- `llm_connector_cache_hits_total` - Cache hits

---

## Middleware Pipeline

Middleware executes in the order it's added.

### Pipeline Order

```typescript
hub.use(new LoggingMiddleware());    // 1. Log request
hub.use(new CacheMiddleware());      // 2. Check cache
hub.use(new RateLimitMiddleware());  // 3. Check rate limit
hub.use(new RetryMiddleware());      // 4. Retry on failure

// Execution order:
// Request  → Logging → Cache → RateLimit → Retry → Provider
// Response ← Logging ← Cache ← RateLimit ← Retry ← Provider
```

### Conditional Middleware

Apply middleware only for specific conditions:

```typescript
import { ConditionalMiddleware } from '@llm-connector-hub/middleware';

hub.use(new ConditionalMiddleware({
  condition: (request) => request.provider === 'openai',
  middleware: new RateLimitMiddleware({ maxRequests: 50 })
}));

// Or create custom conditional logic
class OpenAIOnlyMiddleware implements Middleware {
  async process(request, next) {
    if (request.provider === 'openai') {
      // Apply specific logic for OpenAI
      console.log('OpenAI request');
    }
    return next(request);
  }
}
```

---

## Custom Middleware

### Basic Custom Middleware

```typescript
import { Middleware, CompletionRequest, CompletionResponse } from '@llm-connector-hub/core';

class TimingMiddleware implements Middleware {
  async process(
    request: CompletionRequest,
    next: (req: CompletionRequest) => Promise<CompletionResponse>
  ): Promise<CompletionResponse> {
    const start = Date.now();

    try {
      const response = await next(request);
      const duration = Date.now() - start;

      console.log(`Request took ${duration}ms`);

      return response;
    } catch (error) {
      const duration = Date.now() - start;
      console.log(`Request failed after ${duration}ms`);
      throw error;
    }
  }
}

hub.use(new TimingMiddleware());
```

### Request Modification Middleware

```typescript
class RequestModifierMiddleware implements Middleware {
  async process(request, next) {
    // Modify request
    const modifiedRequest = {
      ...request,
      temperature: Math.min(request.temperature || 0.7, 1.0),
      max_tokens: request.max_tokens || 1000
    };

    return next(modifiedRequest);
  }
}
```

### Response Modification Middleware

```typescript
class ResponseModifierMiddleware implements Middleware {
  async process(request, next) {
    const response = await next(request);

    // Modify response
    return {
      ...response,
      content: response.content.trim(),
      metadata: {
        ...response.metadata,
        processed: true,
        processingTime: Date.now()
      }
    };
  }
}
```

### Error Handling Middleware

```typescript
class ErrorHandlingMiddleware implements Middleware {
  async process(request, next) {
    try {
      return await next(request);
    } catch (error) {
      console.error('Request failed:', error);

      // Transform error
      if (error.type === 'rate_limit') {
        throw new Error('Please slow down your requests');
      }

      // Or provide fallback
      return {
        content: 'I apologize, but I encountered an error.',
        error: error.message,
        metadata: { provider: request.provider, error: true }
      };
    }
  }
}
```

### Authentication Middleware

```typescript
class AuthMiddleware implements Middleware {
  private apiKeys: Map<string, string>;

  constructor(apiKeys: Record<string, string>) {
    this.apiKeys = new Map(Object.entries(apiKeys));
  }

  async process(request, next) {
    const apiKey = this.apiKeys.get(request.provider);

    if (!apiKey) {
      throw new Error(`No API key configured for ${request.provider}`);
    }

    // Add authentication headers
    const authenticatedRequest = {
      ...request,
      headers: {
        ...request.headers,
        'Authorization': `Bearer ${apiKey}`
      }
    };

    return next(authenticatedRequest);
  }
}
```

---

## Advanced Patterns

### Middleware with State

```typescript
class StatefulMiddleware implements Middleware {
  private requestCount = 0;
  private totalTokens = 0;

  async process(request, next) {
    this.requestCount++;

    const response = await next(request);

    this.totalTokens += response.usage?.total_tokens || 0;

    console.log(`Total requests: ${this.requestCount}`);
    console.log(`Total tokens: ${this.totalTokens}`);

    return response;
  }

  getStats() {
    return {
      requests: this.requestCount,
      tokens: this.totalTokens
    };
  }
}

const stateful = new StatefulMiddleware();
hub.use(stateful);

// Later, get stats
console.log(stateful.getStats());
```

### Async Initialization

```typescript
class AsyncMiddleware implements Middleware {
  private initialized = false;
  private config: any;

  async initialize() {
    // Load config from database, API, etc.
    this.config = await loadConfigFromDatabase();
    this.initialized = true;
  }

  async process(request, next) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Use loaded config
    const modifiedRequest = {
      ...request,
      ...this.config
    };

    return next(modifiedRequest);
  }
}
```

### Middleware Composition

```typescript
class CompositeMiddleware implements Middleware {
  constructor(private middlewares: Middleware[]) {}

  async process(request, next) {
    const executeMiddleware = async (
      index: number,
      req: CompletionRequest
    ): Promise<CompletionResponse> => {
      if (index >= this.middlewares.length) {
        return next(req);
      }

      const middleware = this.middlewares[index];
      return middleware.process(req, (r) => executeMiddleware(index + 1, r));
    };

    return executeMiddleware(0, request);
  }
}

// Compose multiple middleware
const composite = new CompositeMiddleware([
  new LoggingMiddleware(),
  new CacheMiddleware(),
  new RetryMiddleware()
]);

hub.use(composite);
```

---

## Best Practices

1. **Order Matters**: Place middleware in logical order
2. **Keep It Simple**: Each middleware should do one thing well
3. **Handle Errors**: Always handle errors gracefully
4. **Be Efficient**: Avoid expensive operations in middleware
5. **Document Behavior**: Clearly document what each middleware does
6. **Test Thoroughly**: Test middleware in isolation and as part of pipeline

---

## Next Steps

- **[Caching Guide](./caching.md)** - Deep dive into caching strategies
- **[Error Handling](./error-handling.md)** - Comprehensive error handling
- **[Health Monitoring](./health-monitoring.md)** - Monitor middleware performance
- **[API Reference](../api/middleware.md)** - Complete middleware API
