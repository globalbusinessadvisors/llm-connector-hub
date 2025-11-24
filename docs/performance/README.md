# Performance Documentation

## Overview

This documentation provides comprehensive information about LLM Connector Hub's performance characteristics, benchmarking methodology, and optimization strategies. The framework is designed to add minimal overhead while providing enterprise-grade reliability and extensibility.

## Performance Philosophy

LLM Connector Hub is built with performance as a core design principle:

- **Minimal Overhead**: Framework adds <100ms latency to LLM API calls
- **Zero-Copy Operations**: Streaming responses pass through without buffering
- **Efficient Caching**: Memory and Redis backends with smart invalidation
- **Connection Pooling**: Reused HTTP connections reduce handshake overhead
- **Async-First**: Non-blocking operations throughout the stack

## Quick Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Framework Overhead | <100ms | Additional latency beyond provider API |
| Memory Footprint | ~50MB | Base without cache |
| Throughput (no cache) | 100+ req/s | Single Node.js instance |
| Throughput (with cache) | 1000+ req/s | Memory cache, cache hits |
| Cache Hit Rate | 70-90% | Typical production workload |
| P99 Latency | <5s | Including provider API time |
| Connection Pool Size | 50 | Default HTTP agent |

## Documentation Structure

### 1. [Benchmarks](./benchmarks.md)
Detailed benchmark results, methodology, and performance comparisons across:
- Different providers (OpenAI, Anthropic, Google)
- Caching strategies (memory vs Redis)
- Middleware configurations
- Load scenarios

### 2. [Optimization Guide](./optimization-guide.md)
Best practices for optimizing performance:
- Configuration tuning
- Memory optimization
- Network optimization
- Caching strategies
- Load balancing

### 3. [Monitoring](./monitoring.md)
Production monitoring and observability:
- Metrics to track
- Alert thresholds
- Dashboard setup
- Performance troubleshooting

## Benchmark Methodology

### Test Environment

All benchmarks are run on standardized hardware to ensure reproducibility:

**Hardware Specifications:**
- CPU: 8 vCPUs (Intel Xeon or equivalent)
- RAM: 16 GB
- Network: 1 Gbps
- Storage: SSD

**Software Stack:**
- Node.js: v20.x LTS
- OS: Ubuntu 22.04 LTS
- Redis: v7.x (when applicable)

### Test Scenarios

#### 1. Simple Completion
Single message request with minimal configuration:
```typescript
await hub.complete({
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

#### 2. Streaming Response
Long-form content generation with streaming:
```typescript
const stream = await hub.streamComplete({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Write a story...' }]
});
```

#### 3. Cached Requests
Repeated identical requests to test cache performance:
```typescript
hub.use(new CacheMiddleware({ type: 'memory', ttl: 3600 }));
// Multiple identical requests
```

#### 4. High Concurrency
Parallel requests to test throughput limits:
```typescript
await Promise.all(
  Array(100).fill(null).map(() => hub.complete({...}))
);
```

#### 5. Multi-Provider Fallback
Provider switching under load:
```typescript
// Attempt primary provider, fallback to secondary
```

### Metrics Collected

#### Latency Metrics
- **P50 (Median)**: 50th percentile response time
- **P90**: 90th percentile response time
- **P95**: 95th percentile response time
- **P99**: 99th percentile response time
- **Max**: Maximum observed response time

#### Throughput Metrics
- **Requests per second (req/s)**: Total requests completed per second
- **Tokens per second**: Total tokens processed per second
- **Cache hit rate**: Percentage of requests served from cache

#### Resource Metrics
- **CPU utilization**: Average and peak CPU usage
- **Memory usage**: Heap size and RSS
- **Network I/O**: Bytes sent/received
- **Connection pool**: Active and idle connections

## Running Benchmarks

### Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Configure API keys:
```bash
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export GOOGLE_API_KEY="your-key"
```

3. Start Redis (for cache benchmarks):
```bash
docker run -d -p 6379:6379 redis:7
```

### Running Standard Benchmarks

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmark suite
npm run benchmark:simple
npm run benchmark:streaming
npm run benchmark:cache
npm run benchmark:concurrency

# Run with custom parameters
npm run benchmark -- --duration=60 --concurrency=50
```

### Custom Benchmark Scripts

Create custom benchmarks in `benchmarks/custom/`:

```typescript
// benchmarks/custom/my-test.ts
import { ConnectorHub } from '@llm-connector-hub/hub';
import { benchmark } from '../utils';

async function myBenchmark() {
  const hub = new ConnectorHub();
  // Setup...

  await benchmark({
    name: 'My Custom Test',
    iterations: 1000,
    fn: async () => {
      await hub.complete({...});
    }
  });
}

myBenchmark();
```

Run custom benchmarks:
```bash
npx tsx benchmarks/custom/my-test.ts
```

## Interpreting Results

### Understanding Latency

**Framework Overhead:**
Framework overhead is calculated as:
```
Overhead = Total Latency - Provider API Latency
```

Typical breakdown:
- Middleware processing: 10-30ms
- Request/response normalization: 5-15ms
- Logging/metrics: 5-10ms
- Cache lookup: 1-5ms (memory), 5-20ms (Redis)

**Expected Latencies by Provider:**

| Provider | Model | Typical P50 | Typical P99 |
|----------|-------|-------------|-------------|
| OpenAI | gpt-3.5-turbo | 500-800ms | 2-3s |
| OpenAI | gpt-4 | 1-2s | 5-8s |
| Anthropic | claude-3-haiku | 400-700ms | 2-3s |
| Anthropic | claude-3-sonnet | 800ms-1.5s | 3-5s |
| Google | gemini-pro | 600-900ms | 2-4s |

### Understanding Throughput

**Factors Affecting Throughput:**

1. **Caching**: Cache hits dramatically increase throughput
   - No cache: 100-200 req/s
   - Memory cache: 500-1000 req/s
   - Redis cache: 300-600 req/s

2. **Model complexity**: Larger models = lower throughput
   - GPT-3.5: Higher throughput
   - GPT-4: Lower throughput

3. **Response size**: Larger responses take longer
   - Short responses (50 tokens): Higher throughput
   - Long responses (1000+ tokens): Lower throughput

4. **Provider rate limits**: External constraint
   - Respect provider rate limits
   - Use rate limiting middleware

### Resource Utilization

**Memory Usage:**
```
Total Memory = Base + Cache + Buffers
```

- Base: ~50MB (framework)
- Cache: Depends on configuration
  - Memory cache: 100MB-1GB
  - Redis: Minimal client overhead
- Buffers: ~1MB per concurrent request

**CPU Usage:**
- Idle: <1%
- Light load (10 req/s): 5-10%
- Heavy load (100 req/s): 30-50%
- Cache processing: +5-15%

## Performance Targets

### Service Level Objectives (SLOs)

| Metric | Target | Rationale |
|--------|--------|-----------|
| Availability | 99.9% | 3 nines for production services |
| P50 Latency | <2s | Acceptable user experience |
| P95 Latency | <5s | Edge case performance |
| P99 Latency | <10s | Worst case handling |
| Error Rate | <0.1% | High reliability |
| Cache Hit Rate | >60% | Cost optimization |

### Capacity Planning

**Single Instance Capacity:**
- Without caching: 100-200 req/s
- With caching: 500-1000 req/s
- Max concurrent requests: 100-200

**Scaling Guidelines:**
```
Required Instances = (Peak RPS / Target RPS per Instance) * Safety Factor
```

Example:
- Peak load: 5000 req/s
- Target: 500 req/s per instance (with caching)
- Safety factor: 1.5
- Required instances: (5000 / 500) * 1.5 = 15 instances

## Performance Tuning Guide

### Quick Wins

1. **Enable Caching**
```typescript
hub.use(new CacheMiddleware({
  type: 'memory',
  ttl: 3600,
  maxSize: 1000
}));
```
Impact: 5-10x throughput increase

2. **Connection Pool Tuning**
```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  httpAgent: new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10
  })
});
```
Impact: 20-30% latency reduction

3. **Disable Unnecessary Middleware**
```typescript
// Only use what you need
hub.use(new CacheMiddleware({...}));
// hub.use(new LoggingMiddleware({...})); // Disable in production
```
Impact: 10-20% overhead reduction

4. **Request Timeouts**
```typescript
const response = await hub.complete({
  provider: 'openai',
  messages: [...],
  timeout: 30000 // 30 second timeout
});
```
Impact: Prevents hung requests

### Advanced Tuning

See [Optimization Guide](./optimization-guide.md) for detailed tuning strategies.

## Troubleshooting Performance Issues

### High Latency

**Symptoms:**
- P99 latency > 10s
- User complaints about slow responses

**Diagnosis:**
1. Check provider API latency
2. Review middleware overhead
3. Analyze network latency
4. Check system resources

**Solutions:**
- Increase timeouts
- Optimize middleware chain
- Add caching
- Scale horizontally

### Low Throughput

**Symptoms:**
- req/s below target
- Request queuing
- Timeouts under load

**Diagnosis:**
1. Check CPU/memory usage
2. Review connection pool settings
3. Analyze cache hit rate
4. Check provider rate limits

**Solutions:**
- Increase connection pool size
- Enable/optimize caching
- Scale horizontally
- Implement request queuing

### Memory Leaks

**Symptoms:**
- Growing memory usage over time
- Out of memory errors
- Degrading performance

**Diagnosis:**
1. Take heap snapshots
2. Review cache configuration
3. Check for event listener leaks
4. Analyze middleware lifecycle

**Solutions:**
- Set cache size limits
- Configure TTL appropriately
- Fix event listener cleanup
- Restart instances periodically

### Cache Issues

**Symptoms:**
- Low cache hit rate
- Stale data
- High memory usage

**Diagnosis:**
1. Review cache keys
2. Check TTL configuration
3. Analyze request patterns
4. Monitor cache size

**Solutions:**
- Optimize cache keys
- Adjust TTL based on use case
- Implement cache warming
- Use Redis for large caches

## Best Practices

### 1. Development Environment

```typescript
// Disable caching for development
if (process.env.NODE_ENV === 'development') {
  // No cache middleware
} else {
  hub.use(new CacheMiddleware({...}));
}
```

### 2. Testing Environment

```typescript
// Use memory cache for testing
hub.use(new CacheMiddleware({
  type: 'memory',
  ttl: 300 // Short TTL
}));
```

### 3. Production Environment

```typescript
// Use Redis cache for production
hub.use(new CacheMiddleware({
  type: 'redis',
  redis: {
    url: process.env.REDIS_URL,
    maxRetriesPerRequest: 3
  },
  ttl: 3600
}));
```

### 4. Monitoring Setup

```typescript
import { MetricsMiddleware } from '@llm-connector-hub/middleware';

hub.use(new MetricsMiddleware({
  prometheus: true,
  statsd: {
    host: process.env.STATSD_HOST,
    port: 8125
  }
}));
```

## Load Testing

### Using Artillery

```yaml
# load-test.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
    - duration: 120
      arrivalRate: 100
      name: "Peak load"

scenarios:
  - name: "LLM completion"
    flow:
      - post:
          url: "/api/complete"
          json:
            provider: "openai"
            messages:
              - role: "user"
                content: "Hello!"
```

Run:
```bash
artillery run load-test.yml
```

### Using k6

```javascript
// load-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
};

export default function() {
  const payload = JSON.stringify({
    provider: 'openai',
    messages: [{ role: 'user', content: 'Hello!' }]
  });

  const res = http.post('http://localhost:3000/api/complete', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });
}
```

Run:
```bash
k6 run load-test.js
```

## Cost-Performance Trade-offs

### Model Selection

| Model | Cost/1K Tokens | Speed | Quality | Use Case |
|-------|----------------|-------|---------|----------|
| GPT-3.5 Turbo | $0.0015 | Fast | Good | High volume, simple tasks |
| GPT-4 | $0.03 | Slow | Excellent | Complex reasoning |
| Claude Haiku | $0.00025 | Fast | Good | High throughput |
| Claude Sonnet | $0.003 | Medium | Excellent | Balanced |
| Gemini Pro | $0.0005 | Fast | Good | Cost-effective |

### Caching Economics

**Example Calculation:**
- Requests per day: 1,000,000
- Average cost per request: $0.01
- Cache hit rate: 80%
- Daily cost without cache: $10,000
- Daily cost with cache: $2,000 + cache infrastructure (~$100)
- **Daily savings: $7,900**

**ROI Timeline:**
- Cache infrastructure cost: $3,000/month
- Monthly savings: ~$237,000
- ROI: Immediate (first day)

## Further Reading

- [Detailed Benchmarks](./benchmarks.md)
- [Optimization Guide](./optimization-guide.md)
- [Monitoring Guide](./monitoring.md)
- [Architecture Overview](../architecture/README.md)
- [Caching Guide](../user-guide/caching.md)

## Support

For performance-related questions or issues:
- GitHub Issues: [Performance Label](https://github.com/your-org/llm-connector-hub/labels/performance)
- Discussions: [Performance Category](https://github.com/your-org/llm-connector-hub/discussions/categories/performance)
- Email: performance@example.com
