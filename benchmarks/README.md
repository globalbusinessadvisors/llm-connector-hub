# LLM Connector Hub - Performance Benchmarking Suite

Comprehensive performance benchmarking and load testing for the LLM Connector Hub.

## Overview

This benchmarking suite provides detailed performance analysis across all components of the LLM Connector Hub:

- **Provider Benchmarks**: Request/response transformation performance
- **Cache Benchmarks**: Cache operations (LRU, in-memory)
- **Middleware Benchmarks**: Pipeline execution overhead
- **Hub Benchmarks**: Provider selection and orchestration
- **Stress Tests**: Concurrent load, memory leaks, sustained load
- **Load Tests**: Ramp-up, peak, endurance, spike scenarios

## Quick Start

### Run All Benchmarks

```bash
npm run bench
```

### Run Specific Benchmark Suites

```bash
npm run bench:provider      # Provider transformation benchmarks
npm run bench:cache         # Cache operations benchmarks
npm run bench:middleware    # Middleware pipeline benchmarks
npm run bench:hub           # Hub orchestration benchmarks
npm run bench:stress        # Stress testing
npm run bench:load          # Load testing
```

### Run with Verbose Output

```bash
npm run bench -- all --verbose
```

### Save Results to File

```bash
npm run bench:save
```

## Benchmark Suites

### 1. Provider Benchmarks

Tests provider-specific transformations:

```bash
npm run bench:provider
```

**Metrics:**
- Request transformation latency (microseconds)
- Response transformation latency
- JSON serialization/deserialization
- Deep cloning performance
- Provider comparison (Anthropic, Google, OpenAI)

**Targets:**
- Request transformation: < 500μs
- Response transformation: < 500μs
- JSON operations: < 1000μs

### 2. Cache Benchmarks

Tests cache implementations and operations:

```bash
npm run bench:cache
```

**Metrics:**
- Cache GET (hit/miss) - microseconds
- Cache SET operations
- Cache DELETE operations
- LRU eviction performance
- Cache key generation speed
- Hit ratio impact

**Targets:**
- Cache operations: < 100μs (in-memory)
- Key generation: < 100μs
- LRU overhead: < 20% vs simple Map

### 3. Middleware Benchmarks

Tests middleware pipeline overhead:

```bash
npm run bench:middleware
```

**Metrics:**
- Individual middleware overhead
- Pipeline execution time
- Context creation/cloning
- Middleware composition

**Targets:**
- Per middleware: < 500μs
- Full pipeline (10 middleware): < 5ms
- Context creation: < 10μs

### 4. Hub Benchmarks

Tests ConnectorHub orchestration:

```bash
npm run bench:hub
```

**Metrics:**
- Provider registration/unregistration
- Provider selection algorithms
- Health monitoring updates
- End-to-end orchestration
- Scalability (1-100 providers)

**Targets:**
- Provider selection: < 1ms
- Health monitoring: < 100μs
- Orchestration overhead: < 2ms

### 5. Stress Tests

Tests system under heavy load:

```bash
npm run bench:stress
```

**Scenarios:**
- Concurrent requests (10, 50, 100, 500, 1000)
- Sustained load (10s, 30s, 60s)
- Memory leak detection
- Error handling under load

**Targets:**
- Throughput: > 1000 req/s
- Memory under load: < 200MB
- Leak rate: < 1%
- Success rate: > 99%

### 6. Load Tests

Progressive load testing scenarios:

```bash
npm run bench:load
```

**Scenarios:**
- **Ramp-up**: Gradual increase from 1 to 1000 concurrent
- **Peak**: Maximum sustained load (1000 concurrent, 1 minute)
- **Endurance**: Long-term stability (100 concurrent, 5 minutes)
- **Spike**: Sudden load spikes (10 → 500 → 10, 3 cycles)

**Metrics:**
- Average throughput (requests/second)
- Peak throughput
- P95/P99 latency
- Memory growth
- Success rate

## Performance Targets

### Component-Level Targets

| Component | Operation | Target | Warning | Error |
|-----------|-----------|--------|---------|-------|
| Provider | Transform | < 500μs | < 1ms | > 2ms |
| Cache | Get/Set | < 100μs | < 200μs | > 500μs |
| Middleware | Per middleware | < 500μs | < 1ms | > 2ms |
| Hub | Orchestration | < 2ms | < 3ms | > 5ms |

### System-Level Targets

| Metric | Target | Warning | Error |
|--------|--------|---------|-------|
| Throughput | > 1000 req/s | > 500 req/s | < 100 req/s |
| Memory | < 200MB | < 300MB | > 500MB |
| CPU Usage | < 80% | < 90% | > 95% |
| Error Rate | < 0.1% | < 1% | > 5% |

## Scripts

### Benchmark Scripts

```bash
# Run all benchmarks with detailed output
npm run bench:all

# Run individual suites
npm run bench:provider
npm run bench:cache
npm run bench:middleware
npm run bench:hub
npm run bench:stress
npm run bench:load

# Save results to file
npm run bench:save

# Analyze results
npm run bench:analyze
```

### Shell Scripts

```bash
# Run comprehensive benchmark suite
bash scripts/performance/run-benchmarks.sh [suite] [--verbose]

# Run load tests
bash scripts/performance/run-load-tests.sh [type]

# Examples
bash scripts/performance/run-benchmarks.sh all --verbose
bash scripts/performance/run-load-tests.sh rampup
```

## Results & Analysis

### Result Files

Results are saved to `benchmarks/results/` in multiple formats:

- **JSON**: Machine-readable results with full data
- **Markdown**: Human-readable reports with tables
- **CSV**: Spreadsheet-compatible data export

### Analyzing Results

```bash
# Analyze results in directory
npm run bench:analyze -- --dir=benchmarks/results

# Compare two result files
npm run bench:analyze -- --baseline=results/baseline.json --current=results/latest.json

# Generate report to file
npm run bench:analyze -- --dir=benchmarks/results --output=report.md
```

### Result Structure

```typescript
interface BenchmarkResult {
  name: string;
  iterations: number;
  averageTime: number;      // microseconds
  minTime: number;
  maxTime: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
  opsPerSecond: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}
```

## Configuration

Edit `benchmarks/config.ts` to customize:

```typescript
export const DEFAULT_CONFIG: BenchmarkConfig = {
  iterations: {
    micro: 10000,          // Micro-benchmarks
    standard: 1000,        // Standard benchmarks
    stress: 5000,          // Stress tests
  },
  warmup: {
    iterations: 100,       // Warmup runs
  },
  concurrency: {
    levels: [1, 10, 50, 100, 500, 1000],
  },
  thresholds: {
    providerOverhead: {
      target: 1000,        // 1ms
      warning: 1500,
      error: 2000,
    },
    // ... more thresholds
  },
};
```

## Memory Leak Detection

Run benchmarks with garbage collection exposed:

```bash
node --expose-gc ./node_modules/.bin/tsx benchmarks/stress-test.ts
```

The stress test suite includes automatic memory leak detection:

- Samples memory usage over 100+ iterations
- Calculates linear regression for growth rate
- Flags leaks if growth rate > 1% per iteration
- Generates memory growth charts

## Best Practices

### Running Benchmarks

1. **Close Other Applications**: Minimize system load
2. **Use Consistent Environment**: Same hardware, OS state
3. **Multiple Runs**: Run 3-5 times, take median
4. **Warmup**: Always include warmup iterations
5. **GC Control**: Use `--expose-gc` for accurate memory measurements

### Interpreting Results

1. **Focus on P95/P99**: Average can hide outliers
2. **Watch for Variance**: High stdDev indicates inconsistency
3. **Compare Baselines**: Track trends over time
4. **Memory Growth**: Monitor heap usage patterns
5. **Throughput vs Latency**: Balance both metrics

### CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/performance.yml
- name: Run Benchmarks
  run: npm run bench:save

- name: Check Thresholds
  run: |
    if npm run bench | grep -q "✗"; then
      echo "Performance regression detected"
      exit 1
    fi
```

## Troubleshooting

### High Memory Usage

```bash
# Run with memory profiling
node --expose-gc --trace-gc ./node_modules/.bin/tsx benchmarks/stress-test.ts
```

### Slow Benchmarks

- Reduce iterations in `config.ts`
- Run specific suites instead of all
- Use shorter load test durations

### Inconsistent Results

- Check system load (other processes)
- Ensure consistent Node.js version
- Increase warmup iterations
- Run multiple times and average

## Advanced Usage

### Custom Benchmarks

Create custom benchmark files:

```typescript
import { runBenchmark, BenchmarkResult } from './setup';

export async function myCustomBenchmark(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  const result = await runBenchmark(
    'My Custom Test',
    () => {
      // Your code to benchmark
    },
    {
      iterations: 10000,
      warmupIterations: 100,
      collectMemory: true
    }
  );

  results.push(result);
  return results;
}
```

### Extending Load Tests

Modify `benchmarks/load-test.ts` to add custom scenarios:

```typescript
export async function runCustomLoadTest(): Promise<LoadTestResult> {
  const coordinator = new LoadTestCoordinator(service);

  // Your custom load pattern
  // ...

  return coordinator.getResults('Custom Test', duration);
}
```

## Performance Monitoring

### Continuous Monitoring

Set up automated benchmarking:

```bash
# Run daily benchmarks
0 2 * * * cd /path/to/project && npm run bench:save
```

### Metrics Dashboard

Export results to your monitoring system:

```bash
npm run bench:analyze -- --format=json --output=metrics.json
# Parse metrics.json and send to Prometheus, DataDog, etc.
```

## Contributing

When adding new features:

1. Add corresponding benchmarks
2. Set performance targets
3. Update this README
4. Run benchmarks before PR
5. Compare with baseline

## License

MIT OR Apache-2.0
