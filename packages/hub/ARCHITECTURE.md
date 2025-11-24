# ConnectorHub Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ConnectorHub                              │
│                   (Main Orchestrator)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ coordinates
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Provider       │  │   Caching       │  │   Health        │
│  Registry       │  │   Layer         │  │   Monitoring    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Selection       │  │  Cache Key      │  │ Health          │
│ Strategies      │  │  Generator      │  │ Monitor         │
│ - Priority      │  │  - SHA256       │  │ - Periodic      │
│ - Round Robin   │  │  - Normalize    │  │ - Thresholds    │
│ - Latency       │  │  - Sort         │  │ - Auto-disable  │
│ - Cost          │  └─────────────────┘  └─────────────────┘
│ - Health        │           │
│ - Failover      │           │
└─────────────────┘           │
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            ┌──────────────┐    ┌──────────────┐
            │ MemoryCache  │    │ RedisCache   │
            │ - LRU        │    │ - Distributed│
            │ - TTL        │    │ - Persistent │
            └──────────────┘    └──────────────┘
```

## Component Architecture

### 1. ConnectorHub (Orchestrator)

The central coordination point that manages the entire request lifecycle.

```typescript
ConnectorHub
├── Configuration
│   ├── selectionStrategy
│   ├── enableCache
│   ├── enableRateLimiting
│   ├── enableCircuitBreaker
│   ├── enableHealthMonitoring
│   └── enableFallback
├── Components
│   ├── ProviderRegistry
│   ├── CacheKey
│   ├── Cache (ICache)
│   ├── RateLimiter (IRateLimiter)
│   ├── CircuitBreakers (Map<string, ICircuitBreaker>)
│   └── MiddlewarePipeline (IMiddlewarePipeline)
└── Methods
    ├── registerProvider()
    ├── complete()
    ├── stream()
    ├── selectProvider()
    └── handleError()
```

### 2. Request Flow

```
┌──────────────┐
│ User Request │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ 1. Cache Check       │ ◄─── CacheKey.generate()
│    - Generate key    │
│    - Check cache     │
└──────┬───────────────┘
       │ cache miss
       ▼
┌──────────────────────┐
│ 2. Provider          │
│    Selection         │ ◄─── SelectionStrategy
│    - Apply strategy  │      - priority
│    - Filter enabled  │      - round-robin
│    - Check model     │      - latency
└──────┬───────────────┘      - etc.
       │
       ▼
┌──────────────────────┐
│ 3. Middleware        │
│    Pipeline (Pre)    │ ◄─── IMiddlewarePipeline
│    - Logging         │
│    - Validation      │
│    - Transform       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 4. Rate Limiting     │ ◄─── IRateLimiter
│    - Check limits    │
│    - Throw if over   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 5. Circuit Breaker   │ ◄─── ICircuitBreaker
│    - Check state     │      (per provider)
│    - Execute or fail │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 6. Provider          │ ◄─── IProvider
│    Execution         │      - complete()
│    - Make request    │      - completeStream()
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 7. Middleware        │
│    Pipeline (Post)   │ ◄─── IMiddlewarePipeline
│    - Transform       │
│    - Metrics         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 8. Cache Store       │ ◄─── ICache.set()
│    - Store response  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 9. Update Metrics    │
│    - Mark used       │
│    - Update stats    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Response to User     │
└──────────────────────┘
```

### 3. Error Handling Flow

```
┌──────────────┐
│ Error Occurs │
└──────┬───────┘
       │
       ▼
┌─────────────────────────┐
│ Middleware Error        │
│ Handlers                │
│ - Transform error       │
│ - Log error             │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Fallback Enabled?       │
└──────┬──────────────────┘
       │ Yes
       ▼
┌─────────────────────────┐
│ Find Alternative        │
│ Providers               │
│ - Filter by model       │
│ - Exclude failed        │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Try Alternative         │
│ (up to max attempts)    │
└──────┬──────────────────┘
       │
       ├─ Success ──► Return Response
       │
       └─ All Failed ──► Throw Error
```

### 4. Provider Registry

```
ProviderRegistry
├── Storage
│   └── Map<string, RegisteredProvider[]>
│       ├── Key: provider.name
│       └── Value: Array sorted by priority
│
├── RegisteredProvider
│   ├── provider: IProvider
│   ├── config: ProviderConfig
│   ├── enabled: boolean
│   ├── priority: number
│   ├── tags: string[]
│   ├── registeredAt: number
│   └── lastUsedAt?: number
│
└── Operations
    ├── register() - O(n log n)
    ├── get() - O(1)
    ├── find() - O(n)
    └── markUsed() - O(1)
```

### 5. Caching Layer

#### Memory Cache (LRU)

```
MemoryCache
├── Data Structures
│   ├── cache: Map<string, LRUNode>
│   ├── head: LRUNode (most recent)
│   └── tail: LRUNode (least recent)
│
├── LRUNode
│   ├── key: string
│   ├── entry: CacheEntry<T>
│   ├── prev: LRUNode | null
│   └── next: LRUNode | null
│
├── CacheEntry<T>
│   ├── value: T
│   ├── createdAt: number
│   ├── expiresAt: number
│   ├── hits: number
│   └── size?: number
│
└── Operations
    ├── get() - O(1)
    ├── set() - O(1)
    ├── delete() - O(1)
    └── evictLRU() - O(1)
```

#### Cache Key Generation

```
CacheKey.generate()
    │
    ▼
Normalize Request
    ├── Extract fields
    │   ├── provider (optional)
    │   ├── model (optional)
    │   ├── messages (always)
    │   ├── temperature (optional, rounded)
    │   └── other params
    │
    ▼
Sort Recursively
    ├── Sort object keys
    ├── Sort nested objects
    └── Maintain array order
    │
    ▼
JSON Stringify
    │
    ▼
Hash (SHA256/MD5/SHA1)
    │
    ▼
Format: prefix:hash
    │
    ▼
Return: "llm:a7f3e2..."
```

### 6. Health Monitoring

```
HealthMonitor
├── Configuration
│   ├── checkInterval: 30000ms
│   ├── failureThreshold: 3
│   ├── recoveryThreshold: 2
│   ├── autoDisable: boolean
│   └── checkTimeout: 5000ms
│
├── State
│   └── Map<string, ProviderHealthResult>
│       ├── providerName
│       ├── status: HealthStatus
│       ├── available: boolean
│       ├── consecutiveFailures: number
│       ├── lastSuccessAt?: number
│       └── lastFailureAt?: number
│
├── Process
│   │
│   ▼
│   Periodic Check (every interval)
│   │
│   ├─► Check Provider Health
│   │   ├── Call provider.healthCheck()
│   │   ├── Apply timeout
│   │   └── Record result
│   │
│   ├─► Update State
│   │   ├── Increment/reset counters
│   │   ├── Check thresholds
│   │   └── Update availability
│   │
│   ├─► Auto-disable (if configured)
│   │   ├── If failures >= threshold
│   │   └── Disable provider
│   │
│   └─► Notify Listeners
│       └── Call registered callbacks
│
└── State Transitions
    HEALTHY ──(failures >= threshold)──► UNHEALTHY
    UNHEALTHY ──(successes >= recovery)──► HEALTHY
```

### 7. Selection Strategies

#### Priority Strategy
```
Candidates (already sorted by priority)
    │
    ▼
Select First (lowest priority number)
    │
    ▼
Return Provider
```

#### Round-Robin Strategy
```
Maintain Index per Group
    │
    ▼
Select: candidates[index % length]
    │
    ▼
Increment Index
    │
    ▼
Return Provider
```

#### Latency-Optimized Strategy
```
Get All Candidates
    │
    ▼
Sort by averageResponseTime
    │
    ▼
Select Fastest
    │
    ▼
Return Provider
```

#### Health-Based Strategy
```
Get All Candidates
    │
    ▼
Check Health Status
    │
    ▼
Prefer HEALTHY over DEGRADED over UNHEALTHY
    │
    ▼
Return Provider
```

## Data Flow Example

### Complete Request with Caching

```
1. User calls hub.complete(request)
   ↓
2. Generate cache key: CacheKey.generate(request)
   Key: "llm:7f3e2a..."
   ↓
3. Check cache: cache.get("llm:7f3e2a...")
   └─ Hit: Return cached response
   └─ Miss: Continue
   ↓
4. Select provider: selectProvider(request)
   Strategy: latency-optimized
   Candidates: [provider1, provider2, provider3]
   Selected: provider1 (100ms avg)
   ↓
5. Execute middleware (pre)
   - LoggingMiddleware: Log request
   - ValidationMiddleware: Validate schema
   ↓
6. Check circuit breaker
   State: CLOSED
   Allow: true
   ↓
7. Execute provider
   provider1.complete(request)
   Response: { id: "...", choices: [...], usage: {...} }
   ↓
8. Execute middleware (post)
   - MetricsMiddleware: Record latency, tokens
   ↓
9. Store in cache
   cache.set("llm:7f3e2a...", response, ttl: 3600000)
   ↓
10. Update registry
    registry.markUsed("provider1")
    ↓
11. Return response to user
```

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Cache get/set | O(1) | HashMap + Linked List |
| Provider registration | O(n log n) | Sorting by priority |
| Provider get | O(1) | HashMap lookup |
| Provider find | O(n) | Linear scan with filters |
| Provider selection (priority) | O(1) | First element |
| Provider selection (round-robin) | O(1) | Index calculation |
| Provider selection (latency) | O(n log n) | Sorting by metrics |
| Health check (all) | O(n) | Parallel execution |
| Cache key generation | O(m) | m = request complexity |

### Space Complexity

| Component | Complexity | Notes |
|-----------|-----------|-------|
| MemoryCache | O(k) | k = max cache size |
| ProviderRegistry | O(p) | p = number of providers |
| HealthMonitor | O(p) | p = number of providers |
| Circuit Breakers | O(p) | p = number of providers |

## Scalability

### Horizontal Scaling

- **Stateless Hub**: Multiple hub instances can run concurrently
- **Redis Cache**: Shared cache across instances
- **Load Balancing**: Distribute requests across hub instances

### Vertical Scaling

- **Memory Cache**: Increase maxSize for more cache entries
- **Provider Pool**: Add more provider instances
- **Parallel Processing**: Multiple concurrent requests

## Reliability

### Fault Tolerance

1. **Circuit Breakers**: Prevent cascading failures
2. **Health Monitoring**: Detect and isolate unhealthy providers
3. **Automatic Fallback**: Retry with alternative providers
4. **Graceful Degradation**: Continue with available providers

### Recovery

1. **Circuit Breaker Reset**: Automatic recovery after timeout
2. **Health Recovery**: Re-enable providers after successful checks
3. **Cache TTL**: Stale data expires automatically
4. **Provider Cleanup**: Graceful shutdown of failed providers

## Security

### API Keys

- Stored in ProviderConfig (not in logs)
- Never cached
- Provider-specific management

### Cache Security

- No sensitive data in cache keys (configurable)
- TTL prevents stale data
- Optional encryption (Redis)

## Monitoring

### Metrics Collected

1. **Provider Metrics**: Requests, latency, tokens, cost
2. **Cache Metrics**: Hit ratio, size, evictions
3. **Health Metrics**: Status, failures, response time
4. **Circuit Breaker Metrics**: State, trips, recovery

### Integration Points

- Middleware for custom metrics
- Health monitor event listeners
- Provider-specific telemetry
- Cache statistics API

## Future Enhancements

### Planned Features

1. **Advanced Caching**
   - Semantic similarity caching
   - Partial response caching
   - Multi-tier cache hierarchy

2. **Smart Selection**
   - ML-based provider selection
   - Cost prediction models
   - Load forecasting

3. **Enhanced Resilience**
   - Adaptive timeouts
   - Bulkhead isolation
   - Request deduplication

4. **Observability**
   - Distributed tracing
   - Detailed performance profiling
   - Real-time dashboards
