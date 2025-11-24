# Caching Guide

Learn how to optimize performance and reduce costs using caching in LLM Connector Hub.

## Table of Contents

1. [Overview](#overview)
2. [Cache Types](#cache-types)
3. [Configuration](#configuration)
4. [Cache Strategies](#cache-strategies)
5. [Best Practices](#best-practices)

---

## Overview

Caching stores LLM responses to avoid redundant API calls, reducing costs and improving response times.

### Benefits

- **Cost Reduction**: Avoid duplicate API calls
- **Performance**: Instant responses from cache
- **Rate Limit Protection**: Reduce request volume
- **Offline Support**: Serve cached responses when API is unavailable

### When to Cache

- Repeated identical queries
- Static content generation
- FAQ responses
- Non-time-sensitive queries

### When NOT to Cache

- Personalized responses
- Time-sensitive data
- Random/creative outputs
- Streaming responses (in most cases)

---

## Cache Types

### Memory Cache

Fast, in-process caching. Best for development and single-instance deployments.

```typescript
import { CacheMiddleware } from '@llm-connector-hub/middleware';

const cache = new CacheMiddleware({
  type: 'memory',
  ttl: 3600, // 1 hour
  maxSize: 1000, // Maximum number of cached items
  evictionPolicy: 'lru' // 'lru' | 'lfu' | 'fifo'
});

hub.use(cache);
```

**Pros:**
- Very fast
- No external dependencies
- Simple setup

**Cons:**
- Not shared across instances
- Lost on restart
- Limited by memory

### Redis Cache

Distributed caching for production deployments.

```typescript
const cache = new CacheMiddleware({
  type: 'redis',
  redis: {
    url: 'redis://localhost:6379',
    keyPrefix: 'llm:cache:',
    db: 0,
    password: process.env.REDIS_PASSWORD,

    // Connection pool
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,

    // Cluster support
    cluster: false,
    clusterNodes: [
      { host: 'redis-1', port: 6379 },
      { host: 'redis-2', port: 6379 }
    ]
  },
  ttl: 3600
});

hub.use(cache);
```

**Pros:**
- Shared across instances
- Persistent
- Scalable
- Advanced features (TTL, eviction)

**Cons:**
- Requires Redis infrastructure
- Network latency
- Additional complexity

### Custom Cache

Implement your own cache backend.

```typescript
import { CacheBackend } from '@llm-connector-hub/core';

class CustomCache implements CacheBackend {
  async get(key: string): Promise<any> {
    // Implement get from your storage
    return await yourStorage.get(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    // Implement set to your storage
    await yourStorage.set(key, value, { ttl });
  }

  async delete(key: string): Promise<void> {
    await yourStorage.delete(key);
  }

  async clear(): Promise<void> {
    await yourStorage.clear();
  }

  async has(key: string): Promise<boolean> {
    return await yourStorage.has(key);
  }
}

const cache = new CacheMiddleware({
  type: 'custom',
  backend: new CustomCache()
});
```

---

## Configuration

### Basic Configuration

```typescript
const cache = new CacheMiddleware({
  type: 'redis',
  ttl: 3600, // Time to live in seconds

  // Cache key generation
  keyGenerator: (request) => {
    const messagesHash = hashMessages(request.messages);
    return `${request.provider}:${request.model}:${messagesHash}`;
  },

  // Conditional caching
  shouldCache: (request, response) => {
    // Only cache successful, deterministic requests
    return (
      response.status === 'success' &&
      (request.temperature || 0) < 0.3 &&
      !request.stream
    );
  },

  // Cache hit/miss callbacks
  onCacheHit: (key) => {
    console.log(`Cache hit: ${key}`);
  },

  onCacheMiss: (key) => {
    console.log(`Cache miss: ${key}`);
  }
});
```

### Advanced Configuration

```typescript
const cache = new CacheMiddleware({
  type: 'redis',
  ttl: 3600,

  // Compression
  compress: true,
  compressionThreshold: 1024, // Compress if > 1KB

  // Serialization
  serializer: {
    serialize: (data) => JSON.stringify(data),
    deserialize: (data) => JSON.parse(data)
  },

  // Namespace for multi-tenant
  namespace: 'tenant-123',

  // Cache warming
  warmup: {
    enabled: true,
    queries: [
      { provider: 'openai', messages: [...] },
      { provider: 'anthropic', messages: [...] }
    ]
  },

  // Monitoring
  metrics: {
    enabled: true,
    trackHitRate: true,
    trackLatency: true
  }
});
```

---

## Cache Strategies

### Time-Based Expiration

```typescript
const cache = new CacheMiddleware({
  type: 'redis',

  // Different TTLs based on request
  ttl: (request) => {
    if (request.model === 'gpt-4') {
      return 7200; // 2 hours for GPT-4
    }
    return 3600; // 1 hour for others
  }
});
```

### Selective Caching

```typescript
const cache = new CacheMiddleware({
  type: 'redis',
  ttl: 3600,

  shouldCache: (request, response) => {
    // Only cache if:
    // 1. Temperature is low (deterministic)
    // 2. Not streaming
    // 3. No function calls
    // 4. Successful response
    return (
      (request.temperature || 0) < 0.3 &&
      !request.stream &&
      !request.tools &&
      response.status === 'success'
    );
  }
});
```

### Content-Based Keys

Generate cache keys based on semantic content:

```typescript
import crypto from 'crypto';

function hashMessages(messages) {
  const content = messages
    .map(m => `${m.role}:${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('|');

  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 16);
}

const cache = new CacheMiddleware({
  type: 'redis',
  ttl: 3600,

  keyGenerator: (request) => {
    const parts = [
      request.provider,
      request.model,
      hashMessages(request.messages),
      request.temperature?.toString() || '0.7',
      request.max_tokens?.toString() || 'default'
    ];

    return parts.join(':');
  }
});
```

### Cache Invalidation

```typescript
import { CacheManager } from '@llm-connector-hub/middleware';

const cacheManager = new CacheManager({
  type: 'redis',
  redis: { url: 'redis://localhost:6379' }
});

// Invalidate specific key
await cacheManager.delete('openai:gpt-4:abc123');

// Invalidate by pattern
await cacheManager.deletePattern('openai:gpt-4:*');

// Invalidate by provider
await cacheManager.deleteByProvider('openai');

// Clear all cache
await cacheManager.clear();

// Invalidate on events
eventEmitter.on('model-updated', async (model) => {
  await cacheManager.deletePattern(`*:${model}:*`);
});
```

### Cache Warming

Pre-populate cache with common queries:

```typescript
import { CacheWarmer } from '@llm-connector-hub/middleware';

const warmer = new CacheWarmer({
  cache: cacheManager,
  hub: hub,

  // Queries to warm
  queries: [
    {
      provider: 'openai',
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'What is AI?' }]
    },
    {
      provider: 'anthropic',
      model: 'claude-3-opus',
      messages: [{ role: 'user', content: 'Explain machine learning.' }]
    }
  ],

  // Warm on schedule
  schedule: '0 */6 * * *', // Every 6 hours

  // Warm on startup
  warmOnStartup: true
});

// Manually warm cache
await warmer.warm();
```

### Multi-Level Caching

Combine memory and Redis for optimal performance:

```typescript
import { MultiLevelCache } from '@llm-connector-hub/middleware';

const cache = new MultiLevelCache({
  levels: [
    // L1: Memory (fast, small)
    {
      type: 'memory',
      ttl: 300, // 5 minutes
      maxSize: 100
    },
    // L2: Redis (slower, larger)
    {
      type: 'redis',
      ttl: 3600, // 1 hour
      redis: { url: 'redis://localhost:6379' }
    }
  ],

  // Promotion strategy
  promoteOnHit: true // Promote from L2 to L1 on hit
});

hub.use(cache);
```

---

## Best Practices

### 1. Choose Appropriate TTL

```typescript
// Short TTL for dynamic content
const newsCache = new CacheMiddleware({
  ttl: 300 // 5 minutes
});

// Long TTL for static content
const docsCache = new CacheMiddleware({
  ttl: 86400 // 24 hours
});

// No expiration for truly static content
const constantCache = new CacheMiddleware({
  ttl: 0 // Never expires (use with caution)
});
```

### 2. Monitor Cache Performance

```typescript
const cache = new CacheMiddleware({
  type: 'redis',
  ttl: 3600,

  metrics: {
    enabled: true,
    trackHitRate: true,
    trackLatency: true
  },

  onCacheHit: (key, latency) => {
    metrics.increment('cache.hits');
    metrics.timing('cache.latency', latency);
  },

  onCacheMiss: (key) => {
    metrics.increment('cache.misses');
  }
});

// Check cache statistics
const stats = await cache.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
console.log(`Average latency: ${stats.avgLatency}ms`);
```

### 3. Handle Cache Failures Gracefully

```typescript
const cache = new CacheMiddleware({
  type: 'redis',
  ttl: 3600,

  // Fallback to no cache on Redis failure
  fallbackOnError: true,

  onError: (error) => {
    console.error('Cache error:', error);
    // Continue without cache
  }
});
```

### 4. Use Compression for Large Responses

```typescript
const cache = new CacheMiddleware({
  type: 'redis',
  ttl: 3600,

  compress: true,
  compressionThreshold: 1024, // Compress if > 1KB
  compressionAlgorithm: 'gzip' // or 'brotli'
});
```

### 5. Implement Cache Tagging

```typescript
const cache = new CacheMiddleware({
  type: 'redis',
  ttl: 3600,

  keyGenerator: (request) => {
    const tags = [
      request.provider,
      request.model,
      request.category || 'general'
    ];

    return {
      key: hashMessages(request.messages),
      tags: tags
    };
  }
});

// Invalidate by tag
await cache.deleteByTag('openai');
await cache.deleteByTag('gpt-4');
```

---

## Examples

### Example: FAQ Bot with Caching

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';
import { CacheMiddleware } from '@llm-connector-hub/middleware';

const hub = new ConnectorHub();

// Cache FAQ responses for 24 hours
const faqCache = new CacheMiddleware({
  type: 'redis',
  ttl: 86400,

  keyGenerator: (request) => {
    // Use question as cache key
    const question = request.messages[request.messages.length - 1].content;
    return `faq:${hashString(question)}`;
  },

  shouldCache: (request, response) => {
    // Only cache FAQ category
    return request.category === 'faq' && response.status === 'success';
  }
});

hub.use(faqCache);

const response = await hub.complete({
  provider: 'openai',
  category: 'faq',
  messages: [
    { role: 'user', content: 'What are your business hours?' }
  ]
});
```

### Example: Cache with Analytics

```typescript
class AnalyticsCache extends CacheMiddleware {
  private analytics: Analytics;

  async process(request, next) {
    const key = this.generateKey(request);
    const cached = await this.get(key);

    if (cached) {
      this.analytics.track('cache_hit', {
        provider: request.provider,
        model: request.model
      });
      return cached;
    }

    this.analytics.track('cache_miss', {
      provider: request.provider,
      model: request.model
    });

    const response = await next(request);

    if (this.shouldCache(request, response)) {
      await this.set(key, response);
    }

    return response;
  }
}
```

---

## Next Steps

- **[Error Handling](./error-handling.md)** - Handle cache errors
- **[Health Monitoring](./health-monitoring.md)** - Monitor cache performance
- **[API Reference](../api/middleware.md)** - Complete caching API
