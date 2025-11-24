# Performance Optimization Guide

## Overview

This guide provides comprehensive strategies for optimizing LLM Connector Hub performance across various dimensions: throughput, latency, memory usage, cost, and reliability. Each optimization includes implementation details, expected impact, and trade-offs.

## Table of Contents

- [Quick Wins](#quick-wins)
- [Configuration Optimization](#configuration-optimization)
- [Caching Strategies](#caching-strategies)
- [Memory Optimization](#memory-optimization)
- [CPU Optimization](#cpu-optimization)
- [Network Optimization](#network-optimization)
- [Load Balancing](#load-balancing)
- [Provider Selection](#provider-selection)
- [Cost Optimization](#cost-optimization)
- [Advanced Techniques](#advanced-techniques)

## Quick Wins

### 1. Enable Caching

**Impact:** 5-10x throughput increase, 80-95% cost reduction

```typescript
import { CacheMiddleware } from '@llm-connector-hub/middleware';

hub.use(new CacheMiddleware({
  type: 'memory',
  ttl: 3600,        // 1 hour
  maxSize: 10000    // 10k entries
}));
```

**Expected Results:**
- Cache hit latency: 3-5ms
- Cache miss overhead: +10ms
- Typical hit rate: 70-90%
- Memory usage: ~25KB per entry

**Trade-offs:**
- Memory consumption increases
- Stale data risk (mitigated by TTL)
- Cache warming required

### 2. Connection Pooling

**Impact:** 20-30% latency reduction, 40% throughput increase

```typescript
import https from 'https';
import { OpenAIProvider } from '@llm-connector-hub/providers';

const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000
});

hub.registerProvider('openai', new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  httpAgent: agent
}));
```

**Expected Results:**
- Connection reuse: >95%
- Handshake time saved: ~100ms per request
- Memory overhead: ~50KB per socket

**Trade-offs:**
- Increased memory usage
- Potential for connection leaks if not managed

### 3. Optimize Middleware Stack

**Impact:** 10-20% overhead reduction

```typescript
// Development: Full stack for debugging
if (process.env.NODE_ENV === 'development') {
  hub.use(new LoggingMiddleware({ level: 'debug' }));
  hub.use(new MetricsMiddleware());
}

// Production: Minimal stack
hub.use(new CacheMiddleware({ type: 'redis', ttl: 3600 }));
hub.use(new RetryMiddleware({ maxAttempts: 3 }));
// Skip logging in production for performance
```

**Expected Results:**
- Overhead per middleware: 5-15ms
- Memory savings: 20-30MB
- CPU savings: 10-15%

### 4. Set Appropriate Timeouts

**Impact:** Prevents resource exhaustion, improves reliability

```typescript
const response = await hub.complete({
  provider: 'openai',
  messages: [...],
  timeout: 30000,     // 30 second timeout
  max_tokens: 500     // Limit response size
});
```

**Expected Results:**
- Prevents hung requests
- Faster failure detection
- Better resource utilization

### 5. Use Streaming for Long Responses

**Impact:** 60-80% reduction in time-to-first-byte

```typescript
// Instead of waiting for full response
const stream = await hub.streamComplete({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...]
});

for await (const chunk of stream) {
  // Process chunks as they arrive
  process.stdout.write(chunk.content || '');
}
```

**Expected Results:**
- Time to first token: ~850ms vs full response: 30-60s
- Constant memory usage vs buffering full response
- Better user experience

## Configuration Optimization

### Hub Configuration

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';

const hub = new ConnectorHub({
  // Global timeout for all requests
  timeout: 60000,

  // Maximum concurrent requests
  maxConcurrentRequests: 100,

  // Request queuing
  queueing: {
    enabled: true,
    maxQueueSize: 1000,
    maxQueueTime: 30000
  },

  // Circuit breaker
  circuitBreaker: {
    enabled: true,
    threshold: 50,      // % error rate
    duration: 60000,    // 1 minute
    minimumRequests: 10
  },

  // Performance monitoring
  monitoring: {
    enabled: true,
    sampleRate: 0.1     // 10% sampling
  }
});
```

### Provider Configuration

```typescript
// OpenAI optimized configuration
hub.registerProvider('openai', new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,

  // Connection pooling
  httpAgent: new https.Agent({
    keepAlive: true,
    maxSockets: 50
  }),

  // Request defaults
  defaults: {
    model: 'gpt-3.5-turbo',  // Faster model by default
    max_tokens: 500,          // Limit token usage
    temperature: 0.7
  },

  // Retry configuration
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    retryableErrors: ['rate_limit', 'server_error']
  },

  // Timeout
  timeout: 30000
}));
```

### Middleware Configuration

```typescript
// Cache middleware - optimized
hub.use(new CacheMiddleware({
  type: 'memory',
  ttl: 3600,
  maxSize: 10000,

  // Custom key generation for better hit rates
  keyGenerator: (request) => {
    const normalized = {
      provider: request.provider,
      model: request.model,
      messages: request.messages,
      temperature: request.temperature || 0.7
    };
    return JSON.stringify(normalized);
  },

  // Only cache successful responses
  shouldCache: (response) => {
    return response.status === 'success' &&
           response.content.length > 50;
  },

  // Cache compression
  compression: true
}));

// Retry middleware - optimized
hub.use(new RetryMiddleware({
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,

  // Only retry specific errors
  retryOn: {
    errorTypes: ['rate_limit', 'timeout', 'server_error'],
    statusCodes: [429, 500, 502, 503, 504]
  },

  // Jitter to prevent thundering herd
  jitter: true
}));

// Rate limiting - optimized
hub.use(new RateLimitMiddleware({
  strategy: 'sliding-window',
  maxRequests: 100,
  windowMs: 60000,

  // Per-provider limits
  perProvider: {
    'openai': 60,
    'anthropic': 50,
    'google': 100
  },

  // Queue instead of reject
  queueWhenLimited: true,
  maxQueueSize: 500
}));
```

## Caching Strategies

### Memory Cache (Development/Small Scale)

**Use When:**
- Development environment
- Single server deployment
- Cache size < 1GB
- Request volume < 1000 req/s

```typescript
hub.use(new CacheMiddleware({
  type: 'memory',
  ttl: 3600,
  maxSize: 10000,

  // LRU eviction
  evictionPolicy: 'lru',

  // Compression for large responses
  compression: {
    enabled: true,
    threshold: 1024  // Compress responses > 1KB
  }
}));
```

**Performance Characteristics:**
- Lookup time: 2-5ms
- Write time: 8-12ms
- Memory: ~25KB per entry
- Hit rate: 85-90%

### Redis Cache (Production/Large Scale)

**Use When:**
- Production environment
- Multi-server deployment
- Cache size > 1GB
- Request volume > 1000 req/s

```typescript
hub.use(new CacheMiddleware({
  type: 'redis',
  redis: {
    host: process.env.REDIS_HOST,
    port: 6379,
    password: process.env.REDIS_PASSWORD,

    // Connection pooling
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,

    // Performance tuning
    lazyConnect: false,
    keepAlive: 30000,

    // Cluster configuration
    cluster: {
      nodes: [
        { host: 'redis-1', port: 6379 },
        { host: 'redis-2', port: 6379 },
        { host: 'redis-3', port: 6379 }
      ],
      redisOptions: {
        password: process.env.REDIS_PASSWORD
      }
    }
  },

  ttl: 3600,

  // Compression
  compression: {
    enabled: true,
    algorithm: 'gzip',
    level: 6
  },

  // Serialization
  serializer: {
    serialize: JSON.stringify,
    deserialize: JSON.parse
  }
}));
```

**Performance Characteristics:**
- Lookup time: 10-15ms
- Write time: 15-20ms
- Network overhead: 5-8ms
- Hit rate: 80-85%

### Hybrid Cache (Best Performance)

**Use When:**
- Maximum performance required
- Budget allows
- Complex caching needs

```typescript
import { HybridCacheMiddleware } from '@llm-connector-hub/middleware';

hub.use(new HybridCacheMiddleware({
  // L1: Memory cache (fast)
  l1: {
    type: 'memory',
    ttl: 300,        // 5 minutes
    maxSize: 1000    // Small, hot items
  },

  // L2: Redis cache (large)
  l2: {
    type: 'redis',
    redis: { /* config */ },
    ttl: 3600        // 1 hour
  },

  // Promotion strategy
  promotion: {
    // Promote to L1 after N hits
    threshold: 3,

    // Items accessed in last N seconds
    timeWindow: 300
  }
}));
```

**Performance Characteristics:**
- L1 hit: 2-5ms (90% of hits)
- L2 hit: 10-15ms (8% of hits)
- Miss: Provider API time (2% of requests)
- Overall hit rate: 98%

### Cache Warming

```typescript
import { CacheWarmer } from '@llm-connector-hub/utils';

const warmer = new CacheWarmer(hub, {
  // Common requests to pre-cache
  requests: [
    {
      provider: 'openai',
      messages: [{ role: 'user', content: 'Hello' }]
    },
    {
      provider: 'openai',
      messages: [{ role: 'user', content: 'What is AI?' }]
    }
    // ... more common requests
  ],

  // Warming strategy
  strategy: 'eager',  // or 'lazy'

  // Schedule
  schedule: '0 */6 * * *',  // Every 6 hours

  // Concurrency
  concurrency: 10
});

// Start warming
await warmer.start();
```

### Cache Invalidation

```typescript
// Time-based (TTL)
hub.use(new CacheMiddleware({
  ttl: 3600  // Auto-expire after 1 hour
}));

// Size-based (LRU)
hub.use(new CacheMiddleware({
  maxSize: 10000,
  evictionPolicy: 'lru'
}));

// Manual invalidation
await hub.cache.invalidate({
  provider: 'openai',
  messages: [{ role: 'user', content: 'Hello' }]
});

// Pattern-based invalidation
await hub.cache.invalidatePattern('openai:*');

// Clear all
await hub.cache.clear();
```

## Memory Optimization

### 1. Limit Cache Size

```typescript
hub.use(new CacheMiddleware({
  type: 'memory',
  maxSize: 5000,           // Limit entries
  maxMemory: 512 * 1024 * 1024,  // 512MB max

  // Aggressive eviction
  evictionPolicy: 'lru',
  evictionThreshold: 0.8   // Evict at 80% full
}));
```

### 2. Enable Compression

```typescript
hub.use(new CacheMiddleware({
  compression: {
    enabled: true,
    algorithm: 'gzip',
    level: 6,                    // Balance speed/compression
    threshold: 1024              // Only compress > 1KB
  }
}));
```

**Compression Ratios:**
- Text responses: 60-80% reduction
- JSON data: 50-70% reduction
- Overhead: 5-10ms per operation

### 3. Streaming for Large Responses

```typescript
// Don't buffer entire response
const stream = await hub.streamComplete({...});

for await (const chunk of stream) {
  // Process immediately, don't accumulate
  await processChunk(chunk);
}
```

### 4. Garbage Collection Tuning

```bash
# V8 flags for better GC performance
node --max-old-space-size=4096 \
     --optimize-for-size \
     --gc-interval=100 \
     app.js
```

### 5. Memory Profiling

```typescript
import v8 from 'v8';
import fs from 'fs';

// Take heap snapshot
const snapshot = v8.writeHeapSnapshot();
console.log('Heap snapshot written to:', snapshot);

// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log({
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  });
}, 60000);
```

## CPU Optimization

### 1. Reduce Middleware Overhead

```typescript
// Use minimal middleware in production
if (process.env.NODE_ENV === 'production') {
  hub.use(new CacheMiddleware({...}));
  hub.use(new RetryMiddleware({...}));
  // Skip logging, metrics, etc.
} else {
  // Full stack for development
  hub.use(new LoggingMiddleware({...}));
  hub.use(new MetricsMiddleware({...}));
  // ...
}
```

### 2. Optimize Serialization

```typescript
// Use faster JSON parser
import { parse, stringify } from 'fast-json-stringify';

hub.use(new CacheMiddleware({
  serializer: {
    serialize: stringify,
    deserialize: parse
  }
}));
```

### 3. Disable Unnecessary Features

```typescript
const hub = new ConnectorHub({
  // Disable features you don't need
  monitoring: { enabled: false },
  tracing: { enabled: false },
  debugging: { enabled: false }
});
```

### 4. Async Processing

```typescript
// Don't block on non-critical operations
hub.use(new LoggingMiddleware({
  async: true,  // Log asynchronously
  buffer: true  // Buffer logs
}));

hub.use(new MetricsMiddleware({
  async: true,  // Send metrics asynchronously
  batchSize: 100
}));
```

### 5. Worker Threads for CPU-Intensive Tasks

```typescript
import { Worker } from 'worker_threads';

// Offload heavy processing to worker
const worker = new Worker('./process-response.js');

worker.postMessage(response);
worker.on('message', (processed) => {
  // Use processed response
});
```

## Network Optimization

### 1. HTTP/2 Support

```typescript
import http2 from 'http2';

// Use HTTP/2 for multiplexing
const client = http2.connect('https://api.openai.com');

hub.registerProvider('openai', new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  httpClient: client
}));
```

**Benefits:**
- Multiplexing: Multiple requests over single connection
- Header compression: Reduced overhead
- Server push: Proactive responses

### 2. Connection Pooling

```typescript
import https from 'https';

const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,        // Max concurrent connections
  maxFreeSockets: 10,    // Keep 10 idle connections
  timeout: 60000,
  scheduling: 'lifo'     // Last-in-first-out for warmest connections
});
```

### 3. DNS Caching

```typescript
import dns from 'dns';
import { lookup } from 'cacheable-lookup';

const cacheable = new lookup();
cacheable.install(agent);

// DNS results cached for 5 minutes
```

### 4. Request Compression

```typescript
hub.registerProvider('openai', new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,

  // Enable compression
  compression: true,

  // Compress requests > 1KB
  compressionThreshold: 1024
}));
```

### 5. Regional Endpoints

```typescript
// Use region-specific endpoints for lower latency
const region = process.env.AWS_REGION || 'us-east-1';

hub.registerProvider('openai', new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  endpoint: `https://api-${region}.openai.com`
}));
```

## Load Balancing

### 1. Round-Robin Provider Selection

```typescript
import { LoadBalancer } from '@llm-connector-hub/utils';

const lb = new LoadBalancer({
  strategy: 'round-robin',
  providers: ['openai', 'anthropic', 'google'],

  // Health checking
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 5000
  }
});

// Automatically selects provider
const response = await lb.complete({
  messages: [{ role: 'user', content: 'Hello' }]
});
```

### 2. Least-Latency Selection

```typescript
const lb = new LoadBalancer({
  strategy: 'least-latency',
  providers: ['openai', 'anthropic', 'google'],

  // Track latency
  latencyTracking: {
    enabled: true,
    windowSize: 100,    // Last 100 requests
    updateInterval: 10000
  }
});
```

### 3. Weighted Selection

```typescript
const lb = new LoadBalancer({
  strategy: 'weighted',
  providers: {
    'openai': 50,      // 50% of traffic
    'anthropic': 30,   // 30% of traffic
    'google': 20       // 20% of traffic
  }
});
```

### 4. Cost-Based Selection

```typescript
const lb = new LoadBalancer({
  strategy: 'cost-optimized',
  providers: ['openai', 'anthropic', 'google'],

  // Provider costs (per 1K tokens)
  costs: {
    'openai': { input: 0.0015, output: 0.002 },
    'anthropic': { input: 0.00025, output: 0.00125 },
    'google': { input: 0.0005, output: 0.0015 }
  },

  // Quality weights
  qualityWeights: {
    'openai': 1.0,
    'anthropic': 0.95,
    'google': 0.85
  }
});
```

### 5. Failover Strategy

```typescript
const lb = new LoadBalancer({
  strategy: 'failover',

  // Priority order
  providers: [
    { name: 'openai', priority: 1 },
    { name: 'anthropic', priority: 2 },
    { name: 'google', priority: 3 }
  ],

  // Retry on failure
  retry: {
    maxAttempts: 3,
    nextProviderOnError: true
  }
});
```

## Provider Selection

### Performance Comparison

| Provider | Model | Speed | Cost | Quality | Use Case |
|----------|-------|-------|------|---------|----------|
| Anthropic | Haiku | ⚡⚡⚡ | $ | ⭐⭐⭐ | High volume |
| Google | Gemini Pro | ⚡⚡⚡ | $ | ⭐⭐⭐⭐ | Cost-effective |
| OpenAI | GPT-3.5 | ⚡⚡ | $$ | ⭐⭐⭐⭐ | Balanced |
| Anthropic | Sonnet | ⚡⚡ | $$ | ⭐⭐⭐⭐⭐ | Quality |
| OpenAI | GPT-4 | ⚡ | $$$$ | ⭐⭐⭐⭐⭐ | Premium |

### Selection Guide

**For High Throughput:**
```typescript
// Use fastest, cheapest models
hub.registerProvider('anthropic', new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaults: { model: 'claude-3-haiku-20240307' }
}));
```

**For Best Quality:**
```typescript
// Use premium models
hub.registerProvider('openai', new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  defaults: { model: 'gpt-4-turbo-preview' }
}));
```

**For Cost Optimization:**
```typescript
// Use cost-effective models
hub.registerProvider('google', new GoogleProvider({
  apiKey: process.env.GOOGLE_API_KEY,
  defaults: { model: 'gemini-pro' }
}));
```

## Cost Optimization

### 1. Maximize Cache Hit Rate

```typescript
// Better cache key generation
hub.use(new CacheMiddleware({
  type: 'redis',
  ttl: 3600,

  keyGenerator: (request) => {
    // Normalize to increase hits
    const normalized = {
      provider: request.provider,
      model: request.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content.trim().toLowerCase()
      })),
      // Round temperature to 1 decimal
      temperature: Math.round((request.temperature || 0.7) * 10) / 10
    };
    return hash(normalized);
  }
}));
```

**Impact:** 80-90% cache hit rate = 80-90% cost reduction

### 2. Set Appropriate max_tokens

```typescript
// Don't over-request tokens
const response = await hub.complete({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...],
  max_tokens: 500  // Set appropriate limit
});
```

**Impact:** 30-50% cost reduction vs unlimited

### 3. Use Cheaper Models When Appropriate

```typescript
// Use cheaper model for simple tasks
const isSimpleTask = analyzeComplexity(userInput);

const response = await hub.complete({
  provider: 'openai',
  model: isSimpleTask ? 'gpt-3.5-turbo' : 'gpt-4',
  messages: [...]
});
```

**Impact:** 95% cost reduction for simple tasks

### 4. Batch Similar Requests

```typescript
// Batch similar requests
const responses = await hub.batch({
  requests: [
    { messages: [{ role: 'user', content: 'Q1' }] },
    { messages: [{ role: 'user', content: 'Q2' }] },
    { messages: [{ role: 'user', content: 'Q3' }] }
  ],
  provider: 'openai',
  model: 'gpt-3.5-turbo'
});
```

**Impact:** Reduced overhead, better cache utilization

### 5. Monitor and Alert

```typescript
import { CostMonitor } from '@llm-connector-hub/utils';

const monitor = new CostMonitor({
  // Alert thresholds
  alerts: {
    daily: 1000,      // $1000/day
    monthly: 25000    // $25k/month
  },

  // Notification
  notifications: {
    email: ['billing@company.com'],
    slack: process.env.SLACK_WEBHOOK
  }
});

hub.use(monitor);
```

## Advanced Techniques

### 1. Request Deduplication

```typescript
import { DeduplicationMiddleware } from '@llm-connector-hub/middleware';

hub.use(new DeduplicationMiddleware({
  // Merge identical concurrent requests
  windowMs: 1000,

  // Key generation
  keyGenerator: (request) => hash(request)
}));
```

**Impact:** Eliminate duplicate API calls

### 2. Response Streaming with Backpressure

```typescript
import { Transform } from 'stream';

const stream = await hub.streamComplete({...});

const backpressure = new Transform({
  highWaterMark: 16,  // Buffer up to 16 chunks

  transform(chunk, encoding, callback) {
    // Apply backpressure
    if (this.readableLength > this.readableHighWaterMark) {
      setTimeout(() => callback(null, chunk), 100);
    } else {
      callback(null, chunk);
    }
  }
});

stream.pipe(backpressure).pipe(output);
```

### 3. Predictive Caching

```typescript
import { PredictiveCacheMiddleware } from '@llm-connector-hub/middleware';

hub.use(new PredictiveCacheMiddleware({
  // Analyze patterns
  patternAnalysis: {
    enabled: true,
    windowSize: 1000,
    minConfidence: 0.7
  },

  // Pre-fetch likely requests
  prefetch: {
    enabled: true,
    maxConcurrent: 5
  }
}));
```

### 4. Adaptive Rate Limiting

```typescript
import { AdaptiveRateLimitMiddleware } from '@llm-connector-hub/middleware';

hub.use(new AdaptiveRateLimitMiddleware({
  // Adjust based on provider responses
  adaptive: true,

  // Start conservative
  initialRate: 50,

  // Increase on success
  increaseRate: 1.1,

  // Decrease on rate limit errors
  decreaseRate: 0.5,

  // Bounds
  minRate: 10,
  maxRate: 200
}));
```

### 5. Circuit Breaker Pattern

```typescript
import { CircuitBreakerMiddleware } from '@llm-connector-hub/middleware';

hub.use(new CircuitBreakerMiddleware({
  // Error threshold
  errorThreshold: 50,    // 50% error rate

  // Minimum requests before opening
  minimumRequests: 10,

  // Time window
  windowMs: 60000,       // 1 minute

  // Open circuit duration
  openDuration: 30000,   // 30 seconds

  // Half-open testing
  halfOpenRequests: 3
}));
```

## Performance Checklist

### Development

- [ ] Use memory cache
- [ ] Enable detailed logging
- [ ] Set reasonable timeouts
- [ ] Use development API keys

### Staging

- [ ] Use Redis cache
- [ ] Enable metrics collection
- [ ] Test with production-like load
- [ ] Measure baseline performance

### Production

- [ ] Use Redis cluster for cache
- [ ] Enable connection pooling
- [ ] Optimize middleware stack
- [ ] Set up monitoring and alerts
- [ ] Configure circuit breakers
- [ ] Enable compression
- [ ] Set appropriate timeouts
- [ ] Use CDN for static assets
- [ ] Implement load balancing
- [ ] Regular performance reviews

## Troubleshooting

### Issue: High Latency

**Diagnosis:**
1. Check provider API latency
2. Review middleware overhead
3. Analyze network latency
4. Check cache hit rate

**Solutions:**
- Enable caching
- Optimize middleware
- Use connection pooling
- Choose faster providers

### Issue: Low Throughput

**Diagnosis:**
1. Check CPU/memory usage
2. Review connection pool size
3. Analyze cache effectiveness
4. Check rate limits

**Solutions:**
- Increase connection pool
- Enable caching
- Scale horizontally
- Optimize code

### Issue: High Memory Usage

**Diagnosis:**
1. Take heap snapshot
2. Review cache size
3. Check for leaks
4. Analyze middleware

**Solutions:**
- Limit cache size
- Use Redis instead of memory
- Fix memory leaks
- Enable compression

## Further Reading

- [Benchmarks](./benchmarks.md)
- [Monitoring Guide](./monitoring.md)
- [Caching Guide](../user-guide/caching.md)
- [Architecture Overview](../architecture/README.md)
