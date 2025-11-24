# @llm-connector-hub/hub

Main orchestrator package for the LLM Connector Hub. Provides intelligent provider management, caching, rate limiting, circuit breaking, and comprehensive middleware support.

## Features

- **Provider Registry**: Register and manage multiple LLM providers
- **Smart Provider Selection**: Multiple selection strategies (round-robin, priority-based, cost-optimized, latency-optimized, health-based, failover)
- **Caching**: In-memory (LRU) and Redis-backed caching with deterministic key generation
- **Health Monitoring**: Automatic health checks with configurable thresholds
- **Middleware Pipeline**: Extensible middleware system for cross-cutting concerns
- **Circuit Breakers**: Prevent cascading failures
- **Rate Limiting**: Per-provider rate limiting
- **Automatic Fallback**: Retry failed requests with alternative providers

## Installation

```bash
npm install @llm-connector-hub/hub @llm-connector-hub/core
```

## Quick Start

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';
import { OpenAIProvider } from '@llm-connector-hub/providers';

// Create hub with builder pattern
const hub = ConnectorHub.builder()
  .selectionStrategy('latency-optimized')
  .addProvider(
    new OpenAIProvider(),
    { apiKey: process.env.OPENAI_API_KEY },
    { priority: 1, tags: ['fast', 'reliable'] }
  )
  .build();

// Make a completion request
const response = await hub.complete({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

## Architecture

### ConnectorHub

The main orchestrator class that coordinates all components:

```typescript
const hub = new ConnectorHub({
  selectionStrategy: 'priority',    // Provider selection strategy
  enableCache: true,                 // Enable caching layer
  enableCircuitBreaker: true,        // Enable circuit breakers
  enableHealthMonitoring: true,      // Enable health monitoring
  enableFallback: true,              // Enable automatic fallback
  maxFallbackAttempts: 2,            // Max fallback attempts
});
```

### Provider Registry

Manages provider registration, lookup, and lifecycle:

```typescript
hub.registerProvider(provider, config, {
  enabled: true,
  priority: 100,  // Lower = higher priority
  tags: ['production', 'fast'],
});

// Find providers
const providers = hub.getRegistry().find({
  enabled: true,
  tags: ['production'],
  model: 'gpt-4',
});
```

### Selection Strategies

**Priority-based** (default):
- Selects provider with lowest priority number
- Deterministic and predictable

**Round-robin**:
- Distributes load evenly across providers
- Good for load balancing

**Latency-optimized**:
- Selects provider with lowest average response time
- Adapts to current performance

**Cost-optimized**:
- Selects cheapest provider for the request
- Requires pricing metadata

**Health-based**:
- Prefers healthy providers
- Integrates with health monitoring

**Failover**:
- Uses primary until it fails
- Automatically switches to backup

### Caching

**Memory Cache** (default):
```typescript
import { MemoryCache } from '@llm-connector-hub/hub';

const cache = new MemoryCache({
  defaultTTL: 3600000,  // 1 hour
  maxSize: 1000,         // Max entries
  evictionStrategy: 'lru',
});

hub = new ConnectorHub({ cache, enableCache: true });
```

**Redis Cache** (optional):
```typescript
import { RedisCache } from '@llm-connector-hub/hub';

const cache = new RedisCache(
  { defaultTTL: 3600000 },
  { host: 'localhost', port: 6379 }
);

await cache.initialize();
hub = new ConnectorHub({ cache, enableCache: true });
```

### Cache Key Generation

Deterministic cache keys ensure identical requests hit the cache:

```typescript
import { CacheKey } from '@llm-connector-hub/hub';

const cacheKey = new CacheKey({
  includeProvider: true,
  includeModel: true,
  includeTemperature: true,
  prefix: 'llm',
  hashAlgorithm: 'sha256',
});

const key = cacheKey.generate(request, 'openai');
```

## Advanced Usage

### Custom Selection Strategy

```typescript
const hub = new ConnectorHub({ selectionStrategy: 'latency-optimized' });

// Manual provider selection
const provider = hub.selectProvider(request);
```

### Health Monitoring

```typescript
import { HealthMonitor } from '@llm-connector-hub/hub';

const monitor = new HealthMonitor(registry, {
  checkInterval: 30000,       // Check every 30s
  failureThreshold: 3,        // Mark unhealthy after 3 failures
  recoveryThreshold: 2,       // Mark healthy after 2 successes
  autoDisable: true,          // Auto-disable unhealthy providers
});

// Listen to health changes
monitor.on((results) => {
  console.log('Health check results:', results);
});

// Get health status
const health = monitor.getHealth('openai');
console.log('OpenAI health:', health);
```

### Fallback and Error Handling

```typescript
const hub = new ConnectorHub({
  enableFallback: true,
  maxFallbackAttempts: 2,
});

try {
  const response = await hub.complete(request);
} catch (error) {
  // All providers failed, including fallbacks
  console.error('All providers failed:', error);
}
```

## Testing

```bash
npm test
npm run test:coverage
```

## API Reference

### ConnectorHub

**Methods:**
- `registerProvider(provider, config, options)` - Register a provider
- `complete(request, providerName?)` - Execute completion request
- `stream(request, providerName?)` - Execute streaming request
- `selectProvider(request)` - Select provider for request
- `getRegistry()` - Get provider registry

### ProviderRegistry

**Methods:**
- `register(provider, options)` - Register provider
- `get(name, index?)` - Get provider by name
- `find(filter)` - Find providers matching filter
- `markUsed(name, index?)` - Mark provider as used

### CacheKey

**Methods:**
- `generate(request, provider?)` - Generate cache key
- `generateWithSuffix(request, provider, suffix)` - Generate key with suffix
- `validate(key)` - Validate key format

### MemoryCache / RedisCache

**Methods:**
- `get<T>(key)` - Get value
- `set<T>(key, value, ttl?)` - Set value
- `has(key)` - Check if key exists
- `delete(key)` - Delete value
- `clear()` - Clear all entries
- `getStats()` - Get cache statistics

## License

MIT OR Apache-2.0
