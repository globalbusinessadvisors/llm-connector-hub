/**
 * Cache Benchmark
 * Measures cache operations performance (LRU, in-memory, Redis simulation)
 */

import { runBenchmark, BenchmarkResult, createMockRequest, createMockResponse } from './setup';
import { SCENARIOS } from './config';

/**
 * Simple LRU Cache implementation for benchmarking
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Delete if exists (to re-add at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Simple in-memory cache (Map-based)
 */
class SimpleCache<K, V> {
  private cache: Map<K, V>;

  constructor() {
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Generate cache key from request
 */
function generateCacheKey(request: any): string {
  return JSON.stringify({
    model: request.model,
    messages: request.messages,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
  });
}

/**
 * Generate cache key using hash (more efficient)
 */
function generateCacheKeyHash(request: any): string {
  const str = JSON.stringify(request);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Benchmark cache operations
 */
export async function benchmarkCache(): Promise<BenchmarkResult[]> {
  console.log('\n🔬 Running Cache Benchmarks...\n');

  const results: BenchmarkResult[] = [];

  // Test different cache sizes
  const cacheSizes = [100, 1000, 10000];

  for (const cacheSize of cacheSizes) {
    const lruCache = new LRUCache<string, any>(cacheSize);
    const simpleCache = new SimpleCache<string, any>();

    // Populate caches
    for (let i = 0; i < cacheSize / 2; i++) {
      const key = `key-${i}`;
      const value = createMockResponse(`Response ${i}`);
      lruCache.set(key, value);
      simpleCache.set(key, value);
    }

    // Benchmark LRU Cache GET (hit)
    const hitResult = await runBenchmark(
      `LRU Cache GET - Hit (size: ${cacheSize})`,
      () => {
        lruCache.get('key-10');
      },
      { iterations: 100000, warmupIterations: 1000, collectMemory: true }
    );
    results.push(hitResult);
    console.log(
      `  ✓ ${hitResult.name}: ${hitResult.averageTime.toFixed(2)}μs (${hitResult.opsPerSecond.toFixed(0)} ops/s)`
    );

    // Benchmark LRU Cache GET (miss)
    const missResult = await runBenchmark(
      `LRU Cache GET - Miss (size: ${cacheSize})`,
      () => {
        lruCache.get('nonexistent-key');
      },
      { iterations: 100000, warmupIterations: 1000, collectMemory: true }
    );
    results.push(missResult);
    console.log(
      `  ✓ ${missResult.name}: ${missResult.averageTime.toFixed(2)}μs (${missResult.opsPerSecond.toFixed(0)} ops/s)`
    );

    // Benchmark LRU Cache SET
    let counter = 0;
    const setResult = await runBenchmark(
      `LRU Cache SET (size: ${cacheSize})`,
      () => {
        lruCache.set(`dynamic-key-${counter++}`, createMockResponse());
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );
    results.push(setResult);
    console.log(
      `  ✓ ${setResult.name}: ${setResult.averageTime.toFixed(2)}μs (${setResult.opsPerSecond.toFixed(0)} ops/s)`
    );

    // Benchmark LRU Cache DELETE
    const deleteResult = await runBenchmark(
      `LRU Cache DELETE (size: ${cacheSize})`,
      () => {
        lruCache.delete('key-5');
        lruCache.set('key-5', createMockResponse()); // Re-add for next iteration
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );
    results.push(deleteResult);
    console.log(
      `  ✓ ${deleteResult.name}: ${deleteResult.averageTime.toFixed(2)}μs (${deleteResult.opsPerSecond.toFixed(0)} ops/s)`
    );

    // Benchmark Simple Cache (Map) operations for comparison
    const simpleGetResult = await runBenchmark(
      `Simple Cache GET (size: ${cacheSize})`,
      () => {
        simpleCache.get('key-10');
      },
      { iterations: 100000, warmupIterations: 1000, collectMemory: true }
    );
    results.push(simpleGetResult);
    console.log(
      `  ✓ ${simpleGetResult.name}: ${simpleGetResult.averageTime.toFixed(2)}μs (${simpleGetResult.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  // Benchmark cache key generation
  console.log('\n  Cache Key Generation:\n');

  for (const [key, scenario] of Object.entries(SCENARIOS.provider)) {
    const request = createMockRequest(scenario.messageCount);

    // JSON-based key generation
    const jsonKeyResult = await runBenchmark(
      `Cache Key Generation - JSON (${scenario.name})`,
      () => {
        generateCacheKey(request);
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );
    results.push(jsonKeyResult);
    console.log(
      `    ✓ ${jsonKeyResult.name}: ${jsonKeyResult.averageTime.toFixed(2)}μs (${jsonKeyResult.opsPerSecond.toFixed(0)} ops/s)`
    );

    // Hash-based key generation
    const hashKeyResult = await runBenchmark(
      `Cache Key Generation - Hash (${scenario.name})`,
      () => {
        generateCacheKeyHash(request);
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );
    results.push(hashKeyResult);
    console.log(
      `    ✓ ${hashKeyResult.name}: ${hashKeyResult.averageTime.toFixed(2)}μs (${hashKeyResult.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  // Benchmark cache eviction under load
  console.log('\n  Cache Eviction:\n');

  const evictionCache = new LRUCache<string, any>(100);
  let evictionCounter = 0;

  const evictionResult = await runBenchmark(
    'LRU Cache Eviction (constant size)',
    () => {
      evictionCache.set(`eviction-key-${evictionCounter++}`, createMockResponse());
    },
    { iterations: 10000, warmupIterations: 100, collectMemory: true }
  );
  results.push(evictionResult);
  console.log(
    `  ✓ ${evictionResult.name}: ${evictionResult.averageTime.toFixed(2)}μs (${evictionResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  // Benchmark cache hit ratio impact
  console.log('\n  Cache Hit Ratio:\n');

  const ratioCache = new LRUCache<string, any>(1000);
  const keys = Array.from({ length: 1000 }, (_, i) => `key-${i}`);

  // Populate cache
  keys.forEach((key, i) => {
    ratioCache.set(key, createMockResponse(`Response ${i}`));
  });

  // Test different hit ratios
  const hitRatios = [90, 70, 50]; // percentage

  for (const hitRatio of hitRatios) {
    let accessCounter = 0;
    const hitRatioResult = await runBenchmark(
      `Cache Access (${hitRatio}% hit ratio)`,
      () => {
        const shouldHit = (accessCounter++ % 100) < hitRatio;
        const key = shouldHit ? keys[accessCounter % keys.length] : `miss-${accessCounter}`;
        ratioCache.get(key);
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );
    results.push(hitRatioResult);
    console.log(
      `  ✓ ${hitRatioResult.name}: ${hitRatioResult.averageTime.toFixed(2)}μs (${hitRatioResult.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  console.log('\n✅ Cache benchmarks completed\n');

  return results;
}

/**
 * Compare cache implementations
 */
export function compareCacheImplementations(results: BenchmarkResult[]): void {
  console.log('\n📊 Cache Implementation Comparison\n');

  const operations = ['GET - Hit', 'GET - Miss', 'SET', 'DELETE'];

  for (const operation of operations) {
    const operationResults = results.filter((r) => r.name.includes(operation) && r.name.includes('1000'));

    if (operationResults.length === 0) continue;

    console.log(`${operation} (cache size: 1000):`);

    const lru = operationResults.find((r) => r.name.includes('LRU'));
    const simple = operationResults.find((r) => r.name.includes('Simple'));

    if (lru) {
      console.log(`  LRU Cache:    ${lru.averageTime.toFixed(2)}μs`);
    }
    if (simple) {
      console.log(`  Simple Cache: ${simple.averageTime.toFixed(2)}μs`);
    }

    if (lru && simple) {
      const overhead = ((lru.averageTime - simple.averageTime) / simple.averageTime) * 100;
      console.log(`  LRU Overhead: ${overhead.toFixed(1)}%`);
    }

    console.log('');
  }

  // Compare key generation methods
  console.log('Cache Key Generation:');
  const jsonKey = results.find((r) => r.name.includes('JSON') && r.name.includes('Small'));
  const hashKey = results.find((r) => r.name.includes('Hash') && r.name.includes('Small'));

  if (jsonKey && hashKey) {
    console.log(`  JSON-based:  ${jsonKey.averageTime.toFixed(2)}μs`);
    console.log(`  Hash-based:  ${hashKey.averageTime.toFixed(2)}μs`);
    const improvement = ((jsonKey.averageTime - hashKey.averageTime) / jsonKey.averageTime) * 100;
    console.log(`  Hash improvement: ${improvement.toFixed(1)}%`);
  }

  console.log('');
}

/**
 * Run cache benchmarks if executed directly
 */
if (require.main === module) {
  benchmarkCache()
    .then((results) => {
      compareCacheImplementations(results);
    })
    .catch((error) => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
