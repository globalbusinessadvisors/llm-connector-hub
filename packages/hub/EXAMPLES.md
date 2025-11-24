# ConnectorHub Usage Examples

Complete examples demonstrating the ConnectorHub orchestrator functionality.

## Basic Usage

### Simple Setup

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';
import { OpenAIProvider } from '@llm-connector-hub/providers';

const hub = new ConnectorHub();

hub.registerProvider(
  new OpenAIProvider(),
  { apiKey: process.env.OPENAI_API_KEY! }
);

const response = await hub.complete({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What is the capital of France?' }
  ],
});

console.log(response.choices[0].message.content);
```

### Builder Pattern

```typescript
const hub = ConnectorHub.builder()
  .selectionStrategy('latency-optimized')
  .addProvider(
    new OpenAIProvider(),
    { apiKey: process.env.OPENAI_API_KEY! },
    { priority: 1, tags: ['fast'] }
  )
  .addProvider(
    new AnthropicProvider(),
    { apiKey: process.env.ANTHROPIC_API_KEY! },
    { priority: 2, tags: ['accurate'] }
  )
  .build();
```

## Provider Selection Strategies

### Priority-Based Selection

```typescript
const hub = new ConnectorHub({ selectionStrategy: 'priority' });

// Lower priority number = higher priority
hub.registerProvider(provider1, config, { priority: 1 });  // Will be selected first
hub.registerProvider(provider2, config, { priority: 2 });  // Backup
hub.registerProvider(provider3, config, { priority: 3 });  // Last resort

const response = await hub.complete(request);
```

### Round-Robin Load Balancing

```typescript
const hub = new ConnectorHub({ selectionStrategy: 'round-robin' });

hub.registerProvider(openai, openaiConfig);
hub.registerProvider(anthropic, anthropicConfig);

// Requests will alternate between providers
for (let i = 0; i < 10; i++) {
  const response = await hub.complete(request);
  // Calls will be distributed: openai, anthropic, openai, anthropic, ...
}
```

### Latency-Optimized Selection

```typescript
const hub = new ConnectorHub({ selectionStrategy: 'latency-optimized' });

hub.registerProvider(provider1, config);
hub.registerProvider(provider2, config);

// Automatically selects provider with lowest average response time
const response = await hub.complete(request);
```

### Health-Based Selection

```typescript
import { HealthMonitor } from '@llm-connector-hub/hub';

const hub = new ConnectorHub({
  selectionStrategy: 'health-based',
  enableHealthMonitoring: true,
  healthCheckInterval: 30000,
});

// Prefers healthy providers, avoids unhealthy ones
const response = await hub.complete(request);
```

## Caching

### In-Memory Cache

```typescript
import { MemoryCache } from '@llm-connector-hub/hub';

const cache = new MemoryCache({
  defaultTTL: 3600000,      // 1 hour
  maxSize: 1000,             // Max 1000 entries
  evictionStrategy: 'lru',   // Least Recently Used
});

const hub = new ConnectorHub({
  cache,
  enableCache: true,
});

// First request - hits provider
const response1 = await hub.complete(request);

// Second identical request - hits cache
const response2 = await hub.complete(request);

// Get cache statistics
console.log(cache.getStats());
// { hits: 1, misses: 1, hitRatio: 0.5, size: 1, ... }
```

### Redis Cache

```typescript
import { RedisCache } from '@llm-connector-hub/hub';

const cache = new RedisCache(
  {
    defaultTTL: 3600000,
    compression: true,
  },
  {
    host: 'localhost',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'llm:',
  }
);

await cache.initialize();

const hub = new ConnectorHub({ cache, enableCache: true });
```

### Custom Cache Keys

```typescript
import { CacheKey } from '@llm-connector-hub/hub';

const cacheKey = new CacheKey({
  includeProvider: true,
  includeModel: true,
  includeTemperature: false,  // Ignore temperature for caching
  prefix: 'my-app',
  hashAlgorithm: 'sha256',
});

// Use with custom cache implementation
const key = cacheKey.generate(request, 'openai');
```

## Health Monitoring

### Basic Health Monitoring

```typescript
import { HealthMonitor } from '@llm-connector-hub/hub';

const registry = hub.getRegistry();

const monitor = new HealthMonitor(registry, {
  checkInterval: 30000,        // Check every 30 seconds
  failureThreshold: 3,         // Mark unhealthy after 3 failures
  recoveryThreshold: 2,        // Mark healthy after 2 successes
  autoDisable: true,           // Auto-disable unhealthy providers
});

// Listen to health changes
monitor.on((results) => {
  console.log('Health check completed:');
  for (const result of results) {
    console.log(`  ${result.providerName}: ${result.status.state}`);
  }
});

// Check all providers
const results = await monitor.checkAll();

// Check specific provider
const health = await monitor.check('openai');
console.log(`OpenAI: ${health.status.state}`);

// Get healthy providers
const healthy = monitor.getHealthyProviders();
console.log('Healthy providers:', healthy);
```

### Custom Health Checks

```typescript
const monitor = new HealthMonitor(registry, {
  customHealthCheck: async (provider) => {
    try {
      // Custom health check logic
      const response = await provider.complete({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'ping' }],
      });
      
      return {
        state: 'healthy',
        message: 'Provider responsive',
        timestamp: Date.now(),
        responseTime: 150,
      };
    } catch (error) {
      return {
        state: 'unhealthy',
        message: error.message,
        timestamp: Date.now(),
      };
    }
  },
});
```

## Error Handling and Fallback

### Automatic Fallback

```typescript
const hub = new ConnectorHub({
  enableFallback: true,
  maxFallbackAttempts: 2,
});

hub.registerProvider(primaryProvider, config, { priority: 1 });
hub.registerProvider(backupProvider1, config, { priority: 2 });
hub.registerProvider(backupProvider2, config, { priority: 3 });

try {
  // If primary fails, automatically tries backup1, then backup2
  const response = await hub.complete(request);
} catch (error) {
  // All providers failed
  console.error('All providers exhausted:', error);
}
```

### Manual Provider Selection

```typescript
// Try specific provider
try {
  const response = await hub.complete(request, 'openai');
} catch (error) {
  // Handle OpenAI-specific error
  console.error('OpenAI failed:', error);
  
  // Try alternative
  const response = await hub.complete(request, 'anthropic');
}
```

## Circuit Breakers

```typescript
import { CircuitBreaker } from '@llm-connector-hub/middleware';

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
  timeout: 10000,
});

const hub = new ConnectorHub({
  enableCircuitBreaker: true,
  circuitBreakers: new Map([
    ['openai', circuitBreaker],
  ]),
});

// Requests will be blocked if circuit is open
try {
  const response = await hub.complete(request);
} catch (error) {
  if (error.message.includes('Circuit is open')) {
    console.log('Circuit breaker is open, provider is failing');
  }
}
```

## Rate Limiting

```typescript
import { RateLimiter } from '@llm-connector-hub/middleware';

const rateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000,  // 100 requests per minute
  strategy: 'sliding',
});

const hub = new ConnectorHub({
  enableRateLimiting: true,
  rateLimiter,
});

try {
  const response = await hub.complete(request);
} catch (error) {
  if (error.name === 'RateLimitError') {
    console.log('Rate limit exceeded, retry after:', error.retryAfter);
  }
}
```

## Streaming

```typescript
const hub = new ConnectorHub();
hub.registerProvider(provider, config);

const request = {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Write a story' }],
  stream: true,
};

for await (const chunk of hub.stream(request)) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

## Advanced: Multi-Provider Setup

```typescript
const hub = ConnectorHub.builder()
  .selectionStrategy('latency-optimized')
  
  // Primary: OpenAI for most requests
  .addProvider(
    new OpenAIProvider(),
    { apiKey: process.env.OPENAI_API_KEY! },
    { priority: 1, tags: ['fast', 'production'] }
  )
  
  // Backup: Anthropic for failover
  .addProvider(
    new AnthropicProvider(),
    { apiKey: process.env.ANTHROPIC_API_KEY! },
    { priority: 2, tags: ['accurate', 'backup'] }
  )
  
  // Cost-effective: Cohere for high-volume
  .addProvider(
    new CohereProvider(),
    { apiKey: process.env.COHERE_API_KEY! },
    { priority: 3, tags: ['cheap', 'volume'] }
  )
  
  // Caching
  .cache(new MemoryCache({ maxSize: 5000 }))
  
  // Rate limiting
  .rateLimiter(new RateLimiter({
    maxRequests: 1000,
    windowMs: 60000,
  }))
  
  .build();

// Use with tags filter
const productionProviders = hub.getRegistry().find({
  tags: ['production'],
  enabled: true,
});

console.log('Production providers:', productionProviders.map(p => p.provider.name));
```

## Metrics and Monitoring

```typescript
// Get provider metrics
const provider = hub.getRegistry().get('openai');
const metrics = provider?.getMetrics();

console.log('OpenAI Metrics:', {
  totalRequests: metrics.totalRequests,
  successRate: metrics.successfulRequests / metrics.totalRequests,
  avgLatency: metrics.averageResponseTime,
  totalTokens: metrics.totalTokens,
  estimatedCost: metrics.totalCost,
});

// Get cache statistics
const cacheStats = cache.getStats();
console.log('Cache Stats:', {
  hitRatio: cacheStats.hitRatio,
  size: cacheStats.size,
  memoryUsage: cacheStats.memoryUsage,
});
```

## Complete Production Example

```typescript
import { ConnectorHub, MemoryCache, HealthMonitor } from '@llm-connector-hub/hub';
import { OpenAIProvider, AnthropicProvider } from '@llm-connector-hub/providers';
import { RateLimiter, CircuitBreaker } from '@llm-connector-hub/middleware';

// Setup cache
const cache = new MemoryCache({
  defaultTTL: 3600000,
  maxSize: 10000,
});

// Setup circuit breakers
const openaiBreaker = new CircuitBreaker({ failureThreshold: 5 });
const anthropicBreaker = new CircuitBreaker({ failureThreshold: 5 });

// Setup rate limiter
const rateLimiter = new RateLimiter({
  maxRequests: 500,
  windowMs: 60000,
});

// Create hub
const hub = ConnectorHub.builder()
  .selectionStrategy('health-based')
  .cache(cache)
  .rateLimiter(rateLimiter)
  .addProvider(
    new OpenAIProvider(),
    { apiKey: process.env.OPENAI_API_KEY! },
    { priority: 1, tags: ['primary'] }
  )
  .addProvider(
    new AnthropicProvider(),
    { apiKey: process.env.ANTHROPIC_API_KEY! },
    { priority: 2, tags: ['backup'] }
  )
  .build();

// Setup health monitoring
const monitor = new HealthMonitor(hub.getRegistry(), {
  checkInterval: 30000,
  failureThreshold: 3,
  autoDisable: true,
});

monitor.on((results) => {
  // Log to monitoring service
  console.log('Health check:', results);
});

// Make requests
async function chat(userMessage: string) {
  try {
    const response = await hub.complete({
      model: 'gpt-4',
      messages: [
        { role: 'user', content: userMessage }
      ],
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}

// Usage
const answer = await chat('What is the capital of France?');
console.log(answer);
```

## Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('ConnectorHub Integration', () => {
  let hub: ConnectorHub;
  
  beforeEach(() => {
    hub = ConnectorHub.builder()
      .addProvider(mockProvider, { apiKey: 'test' })
      .build();
  });
  
  it('should complete request successfully', async () => {
    const response = await hub.complete({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    
    expect(response).toBeDefined();
    expect(response.choices).toHaveLength(1);
  });
});
```
